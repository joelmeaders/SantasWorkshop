import { assertRegistrationReviewAllowed } from '../utility/registration-review-denylist-access';
import { createHash } from 'node:crypto';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
	FieldValue,
	getFirestore,
	type DocumentSnapshot,
} from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	customerLanguageOrEnglish,
	isRegistrationReviewChildAction,
	isRegistrationReviewReason,
	type Child,
	type Registration,
	type RegistrationSearchIndex,
} from '../models';
import { requireEnabledRegistrationReviewAccess } from './registrationReviewAccess';
import {
	performRegistrationReviewDenylistAction,
	type ReviewDenylistActionResult,
} from './registrationReviewDenylistAction';
import {
	canonicalizeChild,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
} from './registrationMutationSupport';
import { normalizeDateTime } from '../utility/date-time-format';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { generateId } from '../utility/id-generation';
import {
	createQrCodeStoragePath,
	ensureSignupQrCode,
} from '../utility/qrcodes';
import {
	renderReviewEmail,
	reviewEmailActions,
	type ReviewEmailAction,
} from '../utility/registration-review-email';

interface ReviewActionInput {
	caseId: string;
	registrationId: string;
	expectedRevision: string;
	mutationId: string;
	action: ReviewEmailAction;
	reason: string;
	notification: { recipient: string; customMessage: string } | null;
	childIndex?: number;
	child?: { firstName: unknown; lastName: unknown; birthDate: unknown };
}

interface ReviewQrIntent {
	qrIntent: true;
	code: string;
	path: string;
}

interface ReviewActionResult {
	action: ReviewEmailAction;
	registrationId: string;
	notification: 'not-requested' | 'queued';
}

const invalid = (message: string): never => {
	throw new HttpsError('invalid-argument', message);
};
const blocked = (message: string): never => {
	throw new HttpsError('failed-precondition', message);
};

const bounded = (
	value: unknown,
	max: number,
	label: string,
	required = true,
): string => {
	if (typeof value !== 'string') return invalid(label + ' is required.');
	const trimmed = value.trim();
	if (trimmed.length > max || (required && !trimmed))
		return invalid(label + ' is invalid.');
	return trimmed;
};

const parseInput = (input: unknown): ReviewActionInput => {
	const data = requireObject(input);
	requireOnlyKeys(data, [
		'caseId',
		'registrationId',
		'expectedRevision',
		'mutationId',
		'action',
		'reason',
		'notification',
		'childIndex',
		'child',
	]);
	const caseId = bounded(data['caseId'], 64, 'Case ID');
	if (!/^[a-f0-9]{64}$/u.test(caseId)) return invalid('Invalid case ID.');
	const registrationId = bounded(
		data['registrationId'],
		128,
		'Registration reference',
	);
	if (!/^[A-Za-z0-9_-]+$/u.test(registrationId))
		return invalid('Invalid registration reference.');
	const expectedRevision = bounded(
		data['expectedRevision'],
		28,
		'Registration revision',
	);
	if (!/^\d{1,12}:\d{1,9}$/u.test(expectedRevision))
		return invalid('Invalid registration revision.');
	const action = data['action'] as ReviewEmailAction;
	if (!reviewEmailActions.includes(action))
		return invalid('Choose a valid action.');
	const note =
		data['notification'] === undefined
			? null
			: requireObject(data['notification']);
	if (note) requireOnlyKeys(note, ['recipient', 'customMessage']);
	const notification = note
		? {
				recipient: bounded(
					note['recipient'],
					254,
					'Notification recipient',
				).toLowerCase(),
				customMessage: bounded(
					note['customMessage'] ?? '',
					2_000,
					'Custom message',
					false,
				),
			}
		: null;
	if (action === 'contact' && !notification)
		return invalid('Contact shopper requires an email.');
	const usesChild =
		action === 'editChild' ||
		action === 'removeChild' ||
		action === 'restoreChild';
	const childIndex = data['childIndex'];
	if (
		usesChild
			? typeof childIndex !== 'number' ||
				!Number.isSafeInteger(childIndex) ||
				childIndex < 0
			: childIndex !== undefined
	)
		return invalid('Choose an existing child.');
	const rawChild = data['child'];
	const child = action === 'editChild' ? requireObject(rawChild) : null;
	if (child) requireOnlyKeys(child, ['firstName', 'lastName', 'birthDate']);
	if (!child && rawChild !== undefined)
		return invalid('Unexpected child details.');
	return {
		caseId,
		registrationId,
		expectedRevision,
		action,
		notification,
		mutationId: requireMutationId(data['mutationId']),
		reason: bounded(
			data['reason'] ?? '',
			500,
			'Internal reason',
			action !== 'contact',
		),
		...(typeof childIndex === 'number' ? { childIndex } : {}),
		...(child
			? {
					child: {
						firstName: child['firstName'],
						lastName: child['lastName'],
						birthDate: child['birthDate'],
					},
				}
			: {}),
	};
};

export function registrationReviewRevision(snapshot: DocumentSnapshot): string {
	const time = snapshot.updateTime;
	return time ? time.seconds + ':' + time.nanoseconds : '';
}

function repeatKey(actorUid: string, input: ReviewActionInput): string {
	return createHash('sha256')
		.update(JSON.stringify([actorUid, input]))
		.digest('hex');
}

function editRosterChild(child: Child, input: ReviewActionInput): Child {
	const edit = input.child;
	if (!edit) return invalid('Updated child details are required.');
	const canonical = canonicalizeChild({
		id: child.id ?? input.childIndex,
		firstName: edit.firstName,
		lastName: edit.lastName,
		dateOfBirth: edit.birthDate,
		toyType: child.toyType,
	});
	return {
		...child,
		firstName: canonical.firstName,
		lastName: canonical.lastName,
		dateOfBirth: canonical.dateOfBirth,
		...(canonical.ageGroup ? { ageGroup: canonical.ageGroup } : {}),
	};
}

function searchIndex(
	registration: Registration,
	uid: string,
): RegistrationSearchIndex {
	const firstName = registration.firstName ?? '';
	const lastName = registration.lastName ?? '';
	return {
		code: registration.qrcode ?? '',
		customerId: uid,
		firstName: firstName.toLowerCase(),
		lastName: lastName.toLowerCase(),
		displayFirstName: firstName,
		displayLastName: lastName,
		emailAddress: registration.emailAddress ?? '',
		zip: registration.zipCode ?? '',
	};
}

/** All shopper/slot/audit/outbox changes are one transaction. No email is sent in it. */
export default async function performRegistrationReviewAction(
	request: CallableRequest<unknown>,
	app: App = admin.app(),
	now: Date = new Date(),
	prepareQr: typeof ensureSignupQrCode = ensureSignupQrCode,
	auth?: Parameters<typeof performRegistrationReviewDenylistAction>[1],
): Promise<ReviewActionResult | ReviewDenylistActionResult> {
	const actorUid = requireEnabledRegistrationReviewAccess(request);
	const input = parseInput(request.data);
	const { caseId, registrationId, mutationId, action, notification } = input;
	if (action === 'blacklist' || action === 'unblacklist') {
		return performRegistrationReviewDenylistAction(
			getFirestore(app),
			auth ?? getAuth(app),
			actorUid,
			{ ...input, action },
			now,
		);
	}
	if (registrationId === actorUid)
		throw new HttpsError('permission-denied', 'Select a shopper account.');
	const db = getFirestore(app);
	const caseRef = db.doc(
		'registrationReviewSeasons/' + PROGRAM_YEAR + '/cases/' + caseId,
	);
	const actionRef = caseRef.collection('actions').doc(mutationId);
	const qrIntentRef = caseRef.collection('qrIntents').doc(mutationId);
	const registrationRef = db
		.collection(COLLECTION_SCHEMA.registrations)
		.doc(registrationId);
	const profileRef = db
		.collection(COLLECTION_SCHEMA.users)
		.doc(registrationId);
	const indexRef = db
		.collection(COLLECTION_SCHEMA.registrationSearchIndex)
		.doc(registrationId);
	const staffRef = db.collection(COLLECTION_SCHEMA.staff).doc(registrationId);
	const checkedInRef = db
		.collection(COLLECTION_SCHEMA.checkins)
		.doc(registrationId);
	const accessRef = db
		.collection(COLLECTION_SCHEMA.shopperAccess)
		.doc(registrationId);
	const removedRosterRef = registrationRef.collection('review').doc('roster');
	const digest = repeatKey(actorUid, input);
	const run = (
		preparedQr?: ReviewQrIntent,
	): Promise<ReviewActionResult | ReviewQrIntent> =>
		db.runTransaction(async (transaction) => {
			const [
				caseSnapshot,
				prior,
				current,
				profile,
				staff,
				checkedIn,
				access,
				removedRoster,
			] = await transaction.getAll(
				caseRef,
				actionRef,
				registrationRef,
				profileRef,
				staffRef,
				checkedInRef,
				accessRef,
				removedRosterRef,
			);
			const participants: unknown = caseSnapshot.get('registrations');
			if (
				!caseSnapshot.exists ||
				caseSnapshot.get('season') !== PROGRAM_YEAR ||
				!Array.isArray(participants) ||
				!participants.includes(registrationId)
			) {
				throw new HttpsError(
					'not-found',
					'Registration is not in this case.',
				);
			}
			if (prior.exists) {
				if (prior.get('digest') !== digest)
					throw new HttpsError(
						'already-exists',
						'This action ID has already been used.',
					);
				return prior.get('result') as ReviewActionResult;
			}
			if (!isRegistrationReviewReason(action, input.reason))
				return invalid('Choose a valid reason for this action.');
			if (notification && isRegistrationReviewChildAction(action))
				return invalid('Child changes do not send shopper email.');
			const registration = current.data() as Registration | undefined;
			if (
				!registration ||
				registration.programYear !== PROGRAM_YEAR ||
				!profile.exists
			)
				return blocked('Select a current shopper registration.');
			if (
				staff.exists ||
				(registration.uid && registration.uid !== registrationId)
			)
				throw new HttpsError(
					'permission-denied',
					'Select a shopper account.',
				);
			if (registrationReviewRevision(current) !== input.expectedRevision)
				throw new HttpsError(
					'aborted',
					'The registration changed. Refresh the case and review it again.',
				);
			if (checkedIn.exists || registration.hasCheckedIn)
				return blocked('This registration has checked in.');
			const email = (registration.emailAddress ?? '')
				.trim()
				.toLowerCase();
			if (notification && (notification.recipient !== email || !email))
				throw new HttpsError(
					'aborted',
					'The email address changed. Refresh the case and review it again.',
				);
			const result: ReviewActionResult = {
				action,
				registrationId,
				notification: notification ? 'queued' : 'not-requested',
			};
			let previousChild: Child | undefined;
			let cancellationEmailId: string | undefined;
			let reinstatedQrCode: string | undefined;
			let priorRegistration:
				| {
						originalSubmittedOn: Date;
						previousDateTimeSlot: NonNullable<
							Registration['dateTimeSlot']
						>;
				  }
				| undefined;
			switch (action) {
				case 'contact':
					break;
				case 'cancel': {
					const slot = registration.dateTimeSlot;
					if (
						!registration.registrationSubmittedOn ||
						!slot?.id ||
						!slot.dateTime ||
						!registration.qrcode ||
						!registration.qrCodeStoragePath ||
						registration.cancelledOn
					) {
						return blocked(
							'Only a current submitted registration with an appointment can be canceled.',
						);
					}
					const cancellation = db
						.collection(COLLECTION_SCHEMA.cancellations)
						.doc();
					priorRegistration = {
						originalSubmittedOn: normalizeDateTime(
							registration.registrationSubmittedOn,
						),
						previousDateTimeSlot: slot,
					};
					cancellationEmailId = cancellation.id;
					transaction.create(cancellation, {
						uid: registrationId,
						actorUid,
						cancelledOn: now,
						programYear: PROGRAM_YEAR,
						...priorRegistration,
						supersededConfirmationCode: registration.qrcode,
						supersededQrCodeStoragePath:
							registration.qrCodeStoragePath,
						replacementConfirmationCode: registration.qrcode,
						replacementQrCodeStoragePath:
							registration.qrCodeStoragePath,
					});
					transaction.update(registrationRef, {
						dateTimeSlot: FieldValue.delete(),
						registrationSubmittedOn: FieldValue.delete(),
						previousDateTimeSlot: slot,
						includedInCounts: false,
						includedInRegistrationStats: false,
						reminderEmailQueuedOn: false,
						reminderEmailSentOn: false,
						reminderEmailFailedOn: false,
						eventReminderQueuedOn: false,
						eventReminderSentOn: false,
						eventReminderFailedOn: false,
						cancelledOn: now,
						cancelledByUid: actorUid,
						cancellationLogId: cancellation.id,
					});
					// Only the derived active-search index is removed; the registration and history remain.
					transaction.delete(indexRef);
					break;
				}
				case 'reinstate': {
					await assertRegistrationReviewAllowed(
						db,
						{
							uid: registrationId,
							email: registration.emailAddress,
						},
						transaction,
					);
					const cancellationId = registration.cancellationLogId;
					if (
						!registration.cancelledOn ||
						registration.registrationSubmittedOn ||
						!cancellationId ||
						!registration.qrcode ||
						!registration.qrCodeStoragePath
					) {
						return blocked(
							'A current canceled registration is required.',
						);
					}
					const cancellation = await transaction.get(
						db
							.collection(COLLECTION_SCHEMA.cancellations)
							.doc(cancellationId),
					);
					const originalSlotId = cancellation.get(
						'previousDateTimeSlot.id',
					) as string | undefined;
					if (
						!cancellation.exists ||
						cancellation.get('uid') !== registrationId ||
						cancellation.get('programYear') !== PROGRAM_YEAR ||
						!originalSlotId
					) {
						return blocked(
							'The original appointment is unavailable.',
						);
					}
					const originalSlot = await transaction.get(
						db.collection('dateTimeSlots').doc(originalSlotId),
					);
					if (
						!originalSlot.exists ||
						originalSlot.get('programYear') !== PROGRAM_YEAR ||
						!originalSlot.get('dateTime')
					) {
						return blocked(
							'The original appointment is unavailable.',
						);
					}
					// Reserve a single immutable replacement before writing to Storage.
					// A lost reply or concurrent retry uses the same QR intent.
					const qrSnapshot = await transaction.get(qrIntentRef);
					if (
						qrSnapshot.exists &&
						qrSnapshot.get('digest') !== digest
					) {
						throw new HttpsError(
							'already-exists',
							'This action ID has already been used.',
						);
					}
					const qrIntent: ReviewQrIntent = qrSnapshot.exists
						? {
								qrIntent: true,
								code: qrSnapshot.get('code') as string,
								path: qrSnapshot.get('path') as string,
							}
						: {
								qrIntent: true,
								code: generateId(8),
								path: createQrCodeStoragePath(registrationId),
							};
					if (!preparedQr) {
						if (!qrSnapshot.exists)
							transaction.create(qrIntentRef, {
								...qrIntent,
								digest,
								createdOn: now,
							});
						return qrIntent;
					}
					if (
						!qrSnapshot.exists ||
						preparedQr.code !== qrIntent.code ||
						preparedQr.path !== qrIntent.path
					) {
						throw new HttpsError(
							'aborted',
							'The replacement confirmation changed. Refresh and try again.',
						);
					}
					reinstatedQrCode = qrIntent.code;
					// Like normal submission, capacity is tracked by reconciliation, not a slot write.
					transaction.update(registrationRef, {
						dateTimeSlot: {
							id: originalSlotId,
							dateTime: originalSlot.get('dateTime') as unknown,
						},
						registrationSubmittedOn:
							cancellation.get('originalSubmittedOn') ?? now,
						qrcode: qrIntent.code,
						qrCodeStoragePath: qrIntent.path,
						qrCodeGeneratedOn: now,
						qrCodeGenerationFailedOn: false,
						includedInCounts: false,
						includedInRegistrationStats: false,
						cancelledOn: FieldValue.delete(),
						cancelledByUid: FieldValue.delete(),
						cancellationLogId: FieldValue.delete(),
					});
					transaction.set(
						indexRef,
						searchIndex(
							{ ...registration, qrcode: qrIntent.code },
							registrationId,
						),
					);
					break;
				}
				case 'disable':
				case 'enable': {
					const disabled = action === 'disable';
					if ((access.get('disabled') === true) === disabled)
						return blocked(
							'Shopper access is already in that state.',
						);
					transaction.set(accessRef, { disabled }, { merge: true });
					const audit = {
						disabled,
						reason: disabled ? input.reason : null,
						evidenceId: null,
						disposition: disabled
							? 'disabled'
							: 'reviewed-and-cleared',
						updatedBy: actorUid,
						updatedAt: now,
					};
					transaction.set(
						accessRef.collection('audit').doc('current'),
						audit,
					);
					transaction.create(
						accessRef.collection('audit').doc(),
						audit,
					);
					// Refresh the optimistic version even though access lives in its own protected document.
					transaction.update(registrationRef, {
						registrationReviewChangedOn: now,
					});
					break;
				}
				case 'editChild':
				case 'removeChild':
				case 'restoreChild': {
					const children = [...(registration.children ?? [])];
					const removed = [
						...((removedRoster.get('children') as
							Child[] | undefined) ?? []),
					];
					const childIndex = input.childIndex;
					if (childIndex === undefined)
						return invalid('Choose an existing child.');
					previousChild = (
						action === 'restoreChild' ? removed : children
					)[childIndex];
					if (!previousChild)
						return blocked(
							'This child is no longer on the registration.',
						);
					if (action === 'editChild') {
						children[childIndex] = editRosterChild(
							previousChild,
							input,
						);
					} else if (action === 'removeChild') {
						if (
							registration.registrationSubmittedOn &&
							children.length === 1
						) {
							return blocked(
								'A submitted registration needs at least one child. Cancel it instead.',
							);
						}
						removed.push(previousChild);
						children.splice(childIndex, 1);
					} else {
						if (
							previousChild.id !== undefined &&
							children.some(({ id }) => id === previousChild?.id)
						) {
							return blocked(
								'This child is already on the registration.',
							);
						}
						children.push(previousChild);
						removed.splice(childIndex, 1);
					}
					if (action !== 'editChild')
						transaction.set(removedRosterRef, {
							children: removed,
						});
					transaction.update(registrationRef, {
						children,
						includedInRegistrationStats: false,
					});
					break;
				}
			}
			transaction.create(actionRef, {
				digest,
				result,
				actorUid,
				action,
				registrationId,
				at: now,
				reason: input.reason,
				...(previousChild
					? { previousChild, childIndex: input.childIndex }
					: {}),
				...(priorRegistration ? { priorRegistration } : {}),
			});
			const history = {
				type: 'action-taken',
				at: now.toISOString(),
				actorUid,
				action,
				registrationId,
			};
			transaction.update(caseRef, {
				lastActionAt: history.at,
				history: FieldValue.arrayUnion(history),
				...(action === 'contact' &&
				caseSnapshot.get('status') !== 'resolved'
					? {
							status: 'pending-shopper-response',
							hasOpenStatus: true,
						}
					: {}),
			});
			if (notification) {
				const language = customerLanguageOrEnglish(
					registration.preferredLanguage ??
						profile.get('preferredLanguage'),
				);
				const email = renderReviewEmail(
					action,
					language,
					registration.firstName ?? '',
					notification.customMessage,
				);
				transaction.create(
					actionRef.collection('email').doc('delivery'),
					{
						recipient: notification.recipient,
						replyTo: email.replyTo,
						subject: email.subject,
						text: email.text,
						html: email.html,
						queuedOn: now,
						state: 'queued',
						caseId,
						registrationId,
						...(cancellationEmailId
							? { cancellationLogId: cancellationEmailId }
							: {}),
						...(reinstatedQrCode
							? { qrcode: reinstatedQrCode }
							: {}),
						action,
					},
				);
			}
			return result;
		});
	const result = await run();
	if (!('qrIntent' in result)) return result;
	await prepareQr(registrationId, result.path, result.code);
	const committed = await run(result);
	if ('qrIntent' in committed)
		throw new HttpsError(
			'internal',
			'The registration was not reinstated.',
		);
	return committed;
}
