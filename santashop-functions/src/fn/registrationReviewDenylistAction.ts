import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
	COLLECTION_SCHEMA,
	isRegistrationReviewReason,
	customerLanguageOrEnglish,
	type Registration,
} from '../models';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { getRegistrationReviewDenylist } from '../utility/registration-review-denylist-access';
import {
	applyRegistrationReviewAuthDenylist,
	verifyRegistrationReviewAuthTarget,
	DenylistAuthTargetError,
} from '../utility/registration-review-denylist-auth';
import { renderReviewEmail } from '../utility/registration-review-email';

export interface ReviewDenylistActionInput {
	caseId: string;
	registrationId: string;
	expectedRevision: string;
	mutationId: string;
	action: 'blacklist' | 'unblacklist';
	reason: string;
	notification: { recipient: string; customMessage: string } | null;
}

export interface ReviewDenylistActionResult {
	action: 'blacklist' | 'unblacklist';
	registrationId: string;
	notification: 'not-requested' | 'queued';
	authAccess: 'disabled-and-revoked' | 'requires-manual-review';
}
type Auth = Parameters<typeof applyRegistrationReviewAuthDenylist>[1];

export async function performRegistrationReviewDenylistAction(
	db: Firestore,
	auth: Auth,
	actorUid: string,
	input: ReviewDenylistActionInput,
	now: Date,
): Promise<ReviewDenylistActionResult> {
	const list = getRegistrationReviewDenylist(db);
	if (!list)
		throw new HttpsError(
			'failed-precondition',
			'Cross-season email block changes are not available.',
		);
	const {
		caseId,
		registrationId,
		action,
		mutationId,
		notification,
		expectedRevision,
		reason,
	} = input;
	if (actorUid === registrationId)
		throw new HttpsError('permission-denied', 'Select a shopper account.');
	const caseRef = db.doc(
		'registrationReviewSeasons/' + PROGRAM_YEAR + '/cases/' + caseId,
	);
	const receiptRef = caseRef.collection('actions').doc(mutationId);
	const registrationRef = db
		.collection(COLLECTION_SCHEMA.registrations)
		.doc(registrationId);
	const profileRef = db
		.collection(COLLECTION_SCHEMA.users)
		.doc(registrationId);
	const staffRef = db.collection(COLLECTION_SCHEMA.staff).doc(registrationId);
	const checkInRef = db
		.collection(COLLECTION_SCHEMA.checkins)
		.doc(registrationId);
	const markerRef = db
		.collection('registrationReviewAuthOperations')
		.doc(registrationId);
	const operationId = createHash('sha256')
		.update(caseRef.path + '/' + mutationId)
		.digest('hex');
	const digest = createHash('sha256')
		.update(JSON.stringify([actorUid, input]))
		.digest('hex');
	const isBlock = action === 'blacklist';
	const attemptId = randomUUID();
	const result: ReviewDenylistActionResult = {
		action,
		registrationId,
		notification: notification ? 'queued' : 'not-requested',
		authAccess: isBlock ? 'disabled-and-revoked' : 'requires-manual-review',
	};

	const preflight = await db.getAll(caseRef, registrationRef);
	const members: unknown = preflight[0]?.get('registrations');
	if (!Array.isArray(members) || !members.includes(registrationId))
		throw new HttpsError('not-found', 'Registration is not in this case.');
	const email = String(preflight[1]?.get('emailAddress') ?? '')
		.trim()
		.toLowerCase();
	if (!email || (notification && email !== notification.recipient))
		throw new HttpsError('aborted', 'The shopper email changed.');
	const target = { uid: registrationId, email, actorUid };
	if (isBlock) {
		try {
			await verifyRegistrationReviewAuthTarget(target, auth);
		} catch (error: unknown) {
			if (error instanceof DenylistAuthTargetError) {
				throw new HttpsError(
					'failed-precondition',
					'The verified shopper account could not be confirmed.',
				);
			}
			throw new HttpsError(
				'unavailable',
				'Could not verify the shopper account. No change was made.',
			);
		}
	}

	const run = async (
		finishAuth: boolean,
	): Promise<'apply-auth' | ReviewDenylistActionResult> =>
		db.runTransaction(async (tx) => {
			const [caseDoc, receipt, current, profile, staff, checkIn, marker] =
				await tx.getAll(
					caseRef,
					receiptRef,
					registrationRef,
					profileRef,
					staffRef,
					checkInRef,
					markerRef,
				);
			const participants: unknown = caseDoc.get('registrations');
			if (
				!Array.isArray(participants) ||
				!participants.includes(registrationId) ||
				caseDoc.get('season') !== PROGRAM_YEAR
			) {
				throw new HttpsError(
					'not-found',
					'Registration is not in this case.',
				);
			}
			const data = current.data() as Registration | undefined;
			const cancellationId = data?.cancellationLogId;
			if (staff.exists || (data?.uid && data.uid !== registrationId))
				throw new HttpsError(
					'permission-denied',
					'Select a shopper account.',
				);
			if (
				!profile.exists ||
				!data ||
				!cancellationId ||
				!data.cancelledOn ||
				data.registrationSubmittedOn ||
				data.programYear !== PROGRAM_YEAR ||
				checkIn.exists ||
				data.hasCheckedIn
			) {
				throw new HttpsError(
					'failed-precondition',
					'The shopper must have a current canceled registration.',
				);
			}
			if (data.emailAddress?.trim().toLowerCase() !== email)
				throw new HttpsError('aborted', 'The shopper email changed.');
			const cancellation = await tx.get(
				db
					.collection(COLLECTION_SCHEMA.cancellations)
					.doc(cancellationId),
			);
			if (
				!cancellation.exists ||
				cancellation.get('uid') !== registrationId ||
				cancellation.get('programYear') !== PROGRAM_YEAR
			) {
				throw new HttpsError(
					'failed-precondition',
					'The current cancellation could not be verified.',
				);
			}
			const bindingMatches =
				marker.get('caseId') === caseId &&
				marker.get('cancellationId') === cancellationId;
			const [emailBlocked, uidBlocked] = await Promise.all([
				list.isEmailBlocked(email, tx),
				list.isUidBlocked(registrationId, tx),
			]);
			const state = marker.get('state') as
				'applying' | 'failed' | 'confirmed' | 'cleared' | undefined;
			if (receipt.exists) {
				if (receipt.get('digest') !== digest)
					throw new HttpsError(
						'already-exists',
						'This action ID has already been used.',
					);
				if (
					isBlock
						? !(
								bindingMatches &&
								emailBlocked &&
								uidBlocked &&
								state === 'confirmed' &&
								marker.get('operationId') === operationId
							)
						: emailBlocked || uidBlocked
				) {
					throw new HttpsError(
						'aborted',
						'The account block changed after that action.',
					);
				}
				return receipt.get('result') as ReviewDenylistActionResult;
			}
			// Only an exact retry of a legacy block may finish an existing operation.
			if (
				!isRegistrationReviewReason(action, reason) &&
				!(
					isBlock &&
					bindingMatches &&
					marker.get('operationId') === operationId &&
					marker.get('digest') === digest &&
					(state === 'failed' || (finishAuth && state === 'applying'))
				)
			) {
				throw new HttpsError(
					'invalid-argument',
					'Choose a valid reason for this action.',
				);
			}
			const time = current.updateTime;
			const revision = time ? time.seconds + ':' + time.nanoseconds : '';
			if (revision !== expectedRevision)
				throw new HttpsError(
					'aborted',
					'The registration changed. Refresh the case and review it again.',
				);

			const binding = {
				caseId,
				cancellationId,
				actorUid,
				shopperUid: registrationId,
			};
			if (!finishAuth && isBlock) {
				if (state === 'applying')
					throw new HttpsError(
						'aborted',
						'An account-disable attempt is still in progress. Do not retry until it has settled.',
					);
				if (emailBlocked || uidBlocked) {
					if (
						!emailBlocked ||
						!uidBlocked ||
						!bindingMatches ||
						state !== 'failed'
					) {
						throw new HttpsError(
							'failed-precondition',
							'An email block is already active.',
						);
					}
					if (
						marker.get('operationId') === operationId &&
						marker.get('digest') !== digest
					) {
						throw new HttpsError(
							'already-exists',
							'This action ID has already been used.',
						);
					}
				} else {
					const policy = await list.apply(tx, {
						...binding,
						email,
						operationId,
						kind: 'block',
						reason,
					});
					if (policy.replayed)
						throw new HttpsError(
							'aborted',
							'That block operation was superseded. Review the account again.',
						);
				}
				tx.set(markerRef, {
					...binding,
					operationId,
					digest,
					attemptId,
					state: 'applying',
					updatedAt: now,
				});
				return 'apply-auth' as const;
			}
			if (finishAuth) {
				if (
					!bindingMatches ||
					!emailBlocked ||
					!uidBlocked ||
					state !== 'applying' ||
					marker.get('attemptId') !== attemptId
				) {
					throw new HttpsError(
						'aborted',
						'The account block changed before completion.',
					);
				}
			} else {
				if (state === 'applying')
					throw new HttpsError(
						'failed-precondition',
						'An account-disable attempt is still in progress.',
					);
				if (
					!bindingMatches ||
					!emailBlocked ||
					!uidBlocked ||
					state !== 'confirmed'
				) {
					throw new HttpsError(
						'failed-precondition',
						'No active block is linked to this cancellation.',
					);
				}
				await list.apply(tx, {
					...binding,
					email,
					kind: 'unblock',
					operationId,
					reason,
				});
			}

			tx.update(markerRef, {
				state: isBlock ? 'confirmed' : 'cleared',
				operationId,
				updatedAt: now,
			});
			tx.update(registrationRef, { registrationReviewChangedOn: now });
			tx.create(receiptRef, {
				digest,
				result,
				action,
				registrationId,
				actorUid,
				at: now,
				reason,
			});
			const event = {
				type: 'action-taken',
				at: now.toISOString(),
				actorUid,
				action,
				registrationId,
			};
			tx.update(caseRef, {
				lastActionAt: event.at,
				history: FieldValue.arrayUnion(event),
			});
			if (notification) {
				const language = customerLanguageOrEnglish(
					data.preferredLanguage ?? profile.get('preferredLanguage'),
				);
				const mail = renderReviewEmail(
					action,
					language,
					data.firstName ?? '',
					notification.customMessage,
				);
				tx.create(receiptRef.collection('email').doc('delivery'), {
					recipient: notification.recipient,
					replyTo: mail.replyTo,
					subject: mail.subject,
					text: mail.text,
					html: mail.html,
					state: 'queued',
					action,
					registrationId,
					caseId,
					cancellationLogId: cancellationId,
					operationId,
					queuedOn: now,
				});
			}
			return result;
		});

	const outcome = await run(false);
	if (outcome !== 'apply-auth') return outcome;
	try {
		await applyRegistrationReviewAuthDenylist(target, auth);
		return (await run(true)) as ReviewDenylistActionResult;
	} catch {
		// Keep policy in force. Only a settled attempt can be explicitly retried;
		// a crashed invocation remains applying, never silently re-enabled.
		const active = await db
			.runTransaction(async (tx): Promise<boolean> => {
				const [current, uidBlocked, emailBlocked] = await Promise.all([
					tx.get(markerRef),
					list.isUidBlocked(registrationId, tx),
					list.isEmailBlocked(email, tx),
				]);
				if (
					current.get('state') !== 'applying' ||
					current.get('attemptId') !== attemptId
				)
					return false;
				tx.update(markerRef, { state: 'failed', updatedAt: now });
				return uidBlocked && emailBlocked;
			})
			.catch(() => false);
		throw new HttpsError(
			'unavailable',
			active
				? 'The email block is active, but account disable could not be verified.'
				: 'The account block outcome could not be verified. Refresh the case.',
			active
				? { reviewActionState: 'block-active-auth-unverified' }
				: undefined,
		);
	}
}
