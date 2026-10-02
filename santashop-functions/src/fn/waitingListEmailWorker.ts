import { randomUUID } from 'node:crypto';
import type { Request } from 'firebase-functions/v2/tasks';
import type { DocumentReference } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import {
	customerLanguageOrEnglish,
	type Registration,
	type User,
} from '../models';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { getWaitingListSettings } from '../utility/waiting-list-settings';
import { waitingListSendingAllowed } from '../utility/waiting-list-email';
import {
	sendWaitingListEmail,
	waitingListSendRate,
} from '../utility/waiting-list-email';
import {
	campaignCollection,
	activeWaitingListQuery,
	campaignDate,
	enqueueWaitingListCampaign,
	type StoredWaitingListCampaign,
	type WaitingListWorkerRequest,
} from './waitingListCampaigns';

interface BatchMember {
	uid: string;
	membershipId: string;
}
interface WorkerCampaign extends StoredWaitingListCampaign {
	batch?: BatchMember[];
	batchCursor?: { joinedOn: string; uid: string };
}
const LEASE_MS = 10 * 60_000;

const permission = async (): Promise<boolean> =>
	(await getWaitingListSettings()).emailSendingEnabled &&
	(await waitingListSendingAllowed());

/** Provider outcomes with an uncertain acceptance must never be retried automatically. */
export const classifyWaitingListSendError = (
	error: unknown,
): 'failed' | 'uncertain' => {
	const status = (error as { $metadata?: { httpStatusCode?: number } })
		?.$metadata?.httpStatusCode;
	// A request timeout does not prove that the provider rejected the message.
	return status !== undefined && status >= 400 && status < 500 && status !== 408
		? 'failed'
		: 'uncertain';
};

/** Retry only the identical receipt write, never the provider request. */
const persistAcceptedReceipt = async (
	ref: DocumentReference,
	accepted: Record<string, unknown>,
): Promise<void> => {
	try {
		await ref.update(accepted);
	} catch {
		// The first write may already have committed. Repeating it is idempotent.
		// A second failure escapes to the worker's pause path without weakening it.
		await ref.update(accepted);
	}
};

const deliver = async (
	ref: DocumentReference,
	campaign: WorkerCampaign,
	member: BatchMember,
	leaseToken: string,
): Promise<void> => {
	const receiptRef = ref.collection('deliveries').doc(member.uid);
	const registrationRef = admin.firestore().doc(`registrations/${member.uid}`);
	const userRef = admin.firestore().doc(`users/${member.uid}`);
	const payload = await admin
		.firestore()
		.runTransaction(async (transaction) => {
			const [current, receipt, registrationSnapshot, userSnapshot] =
				await Promise.all([
					transaction.get(ref),
					transaction.get(receiptRef),
					transaction.get(registrationRef),
					transaction.get(userRef),
				]);
			if (current.data()?.['leaseToken'] !== leaseToken)
				throw new Error('Campaign worker lease changed.');
			const previous = receipt.data();
			if (receipt.exists) {
				if (previous?.['state'] === 'failed' && previous['retryable'] === true) {
					// Only an explicit owner resume advances the generation. A task
					// retry or a crash before the campaign pause must not resend.
					const rejectedGeneration = previous['rejectedGeneration'];
					if (
						!Number.isSafeInteger(rejectedGeneration) ||
						rejectedGeneration >= campaign.generation
					)
						throw new Error('Rejected delivery requires a manual resume.');
				} else {
					if (previous?.['state'] === 'sending')
						transaction.update(receiptRef, {
							state: 'uncertain',
							completedAt: new Date(),
							reason: 'The previous provider request was not confirmed.',
						});
					return undefined;
				}
			}
			const writeReceipt = (value: Record<string, unknown>): void => {
				if (receipt.exists) transaction.update(receiptRef, value);
				else transaction.create(receiptRef, value);
			};
			const registration = registrationSnapshot.data() as
				Registration | undefined;
			const user = userSnapshot.data() as User | undefined;
			const booked = Boolean(
				registration?.registrationSubmittedOn ||
				registration?.dateTimeSlot ||
				registration?.hasCheckedIn,
			);
			if (booked && registration?.waitingList?.active)
				transaction.update(registrationRef, { 'waitingList.active': false });
			if (
				booked ||
				!registration?.waitingList?.active ||
				registration.waitingList.membershipId !== member.membershipId ||
				registration.programYear !== PROGRAM_YEAR ||
				!user?.emailAddress
			) {
				writeReceipt({
					state: 'skipped',
					retryable: false,
					completedAt: new Date(),
					reason: 'Member is no longer eligible.',
					membershipId: member.membershipId,
				});
				return undefined;
			}
			writeReceipt({
				state: 'sending',
				retryable: false,
				reason: '',
				completedAt: null,
				startedAt: new Date(),
				membershipId: member.membershipId,
			});
			return {
				email: user.emailAddress,
				firstName: user.firstName ?? '',
				language: customerLanguageOrEnglish(user.preferredLanguage),
			};
		});
	if (!payload) return;
	const template = campaign.emails.find(
		(email) => email.language === payload.language,
	);
	if (!template) {
		await receiptRef.update({
			state: 'failed',
			reason: 'Frozen email template is unavailable.',
			completedAt: new Date(),
		});
		return;
	}
	// A committed Firestore claim cannot make an external provider call atomic.
	// Keep unknown outcomes terminal for this campaign, including a worker crash.
	const simulated = process.env['FUNCTIONS_EMULATOR'] === 'true';
	let messageId: string;
	try {
		messageId = simulated
			? `emulator-${randomUUID()}`
			: await sendWaitingListEmail(payload.email, payload.firstName, template);
	} catch (error) {
		const state = classifyWaitingListSendError(error);
		await receiptRef.update({
			state,
			retryable: state === 'failed',
			rejectedGeneration: campaign.generation,
			completedAt: new Date(),
			reason:
				state === 'failed'
					? 'SES rejected this request. Resolve the delivery problem before resuming.'
					: 'Provider acceptance is unknown. This recipient will not be retried.',
		});
		// Even MessageRejected can describe a sender/configuration problem.
		// Pause conservatively instead of consuming the rest of the audience.
		throw new Error('Waiting-list delivery stopped. Review before resuming.', {
			cause: error,
		});
	}
	// Persistence errors are not SES errors. Never replace a known acceptance
	// with failed/uncertain or retry the provider after obtaining its message ID.
	await persistAcceptedReceipt(receiptRef, {
		state: 'accepted',
		...(simulated ? { simulated: true } : {}),
		providerMessageId: messageId,
		language: payload.language,
		templateKey: template.templateKey,
		revisionId: template.revisionId,
		completedAt: new Date(),
	});
};

export default async function waitingListEmailWorker(
	request: Request<WaitingListWorkerRequest>,
): Promise<void> {
	const { campaignId, generation } = request.data;
	if (
		!/^[A-Za-z0-9_-]{8,128}$/.test(campaignId) ||
		!Number.isSafeInteger(generation)
	)
		throw new Error('Invalid campaign task.');
	const startedAt = Date.now();
	const ref = campaignCollection().doc(campaignId);
	const token = randomUUID();
	let campaign = await admin.firestore().runTransaction(async (transaction) => {
		const snapshot = await transaction.get(ref);
		if (!snapshot.exists) return undefined;
		const record = snapshot.data() as WorkerCampaign;
		if (
			record.generation !== generation ||
			record.status === 'completed' ||
			record.status === 'paused' ||
			record.programYear !== PROGRAM_YEAR
		)
			return undefined;
		if (
			record.leaseUntil &&
			campaignDate(record.leaseUntil).valueOf() > Date.now()
		)
			throw new Error('Another task holds the campaign lease.');
		transaction.update(ref, {
			status: 'running',
			leaseToken: token,
			leaseUntil: new Date(Date.now() + LEASE_MS),
			updatedAt: new Date(),
			message: '',
		});
		return record;
	});
	if (!campaign) return;
	const update = async (changes: Record<string, unknown>): Promise<void> => {
		await admin.firestore().runTransaction(async (transaction) => {
			const current = await transaction.get(ref);
			if (current.data()?.['leaseToken'] !== token)
				throw new Error('Campaign worker lease changed.');
			transaction.update(ref, { ...changes, updatedAt: new Date() });
		});
	};
	try {
		if (!(await permission())) {
			await update({
				status: 'paused',
				leaseUntil: new Date(0),
				message:
					'Email permission is disabled or unavailable. Resume after checking settings.',
			});
			return;
		}
		const rate =
			process.env['FUNCTIONS_EMULATOR'] === 'true'
				? 1000
				: Math.min(campaign.sendRate, await waitingListSendRate());
		if (!campaign.batch?.length) {
			let query = activeWaitingListQuery(
				campaignDate(campaign.createdAt),
			).limit(50);
			if (campaign.cursor)
				query = query.startAfter(
					new Date(campaign.cursor.joinedOn),
					campaign.cursor.uid,
				);
			const page = await query.get();
			if (page.empty) {
				await admin.firestore().runTransaction(async (transaction) => {
					const lock = campaignCollection().doc('_lock');
					const [current, lockSnapshot] = await Promise.all([
						transaction.get(ref),
						transaction.get(lock),
					]);
					if (current.data()?.['leaseToken'] !== token)
						throw new Error('Campaign worker lease changed.');
					transaction.update(ref, {
						status: 'completed',
						updatedAt: new Date(),
						leaseUntil: new Date(0),
					});
					if (lockSnapshot.data()?.['campaignId'] === campaignId)
						transaction.delete(lock);
				});
				return;
			}
			const last = page.docs[page.docs.length - 1];
			const batch = page.docs.map((doc) => ({
				uid: doc.id,
				membershipId: String(doc.data()['waitingList']?.membershipId ?? ''),
			}));
			const batchCursor = {
				joinedOn: campaignDate(
					last.data()['waitingList'].joinedOn,
				).toISOString(),
				uid: last.id,
			};
			await update({ batch, batchCursor });
			campaign = { ...campaign, batch, batchCursor };
		}
		for (const [index, member] of (campaign.batch ?? []).entries()) {
			if (Date.now() - startedAt > 420_000) {
				await update({
					batch: campaign.batch?.slice(index),
					leaseUntil: new Date(0),
				});
				await enqueueWaitingListCampaign(campaignId, generation);
				return;
			}
			if (!(await permission())) {
				await update({
					status: 'paused',
					leaseUntil: new Date(0),
					message:
						'Email permission changed. Resume this campaign to continue.',
				});
				return;
			}
			await deliver(ref, campaign, member, token);
			await new Promise((resolve) =>
				setTimeout(resolve, Math.ceil(1000 / rate)),
			);
		}
		// Advance only after every receipt is terminal. Each continuation consumes a page.
		await update({
			cursor: campaign.batchCursor,
			batch: [],
			leaseUntil: new Date(0),
		});
		await enqueueWaitingListCampaign(campaignId, generation);
	} catch {
		await update({
			status: 'paused',
			leaseUntil: new Date(0),
			message: 'The campaign stopped. Review its results, then resume.',
		});
	}
}
