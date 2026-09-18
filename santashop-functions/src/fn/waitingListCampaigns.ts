import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFunctions } from 'firebase-admin/functions';
import type { Timestamp, CollectionReference, Query } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	type WaitingListCampaign,
	type WaitingListCampaignPreview,
	type WaitingListEmailPreview,
} from '../models';
import { requireOwner } from '../utility/capabilities';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { FUNCTION_REGION } from '../utility/function-region';
import { getPublicParameters } from '../utility/public-parameters';
import { getWaitingListSettings } from '../utility/waiting-list-settings';
import { waitingListSendingAllowed } from '../utility/waiting-list-email';
import {
	loadWaitingListEmails,
	waitingListSendRate,
} from '../utility/waiting-list-email';
import { getBookingNow } from '../utility/booking-clock';
import { hasWaitingListCapacity } from './waitingList';
import {
	requireObject,
	requireOnlyKeys,
	requireMutationId,
	requireOpenPreRegistration,
} from './registrationMutationSupport';

export interface StoredWaitingListCampaign {
	simulated?: boolean;
	programYear: number;
	actorUid: string;
	status: WaitingListCampaign['status'];
	createdAt: Timestamp | Date;
	updatedAt: Timestamp | Date;
	memberCount: number;
	emails: WaitingListEmailPreview[];
	sendRate: number;
	generation: number;
	cursor?: { joinedOn: string; uid: string };
	leaseUntil?: Timestamp | Date;
	leaseToken?: string;
	message?: string;
}
export interface WaitingListWorkerRequest {
	campaignId: string;
	generation: number;
}
export const campaignCollection = (): CollectionReference =>
	admin.firestore().collection(COLLECTION_SCHEMA.waitingListCampaigns);
export const activeWaitingListQuery = (cutoff: Date): Query =>
	admin
		.firestore()
		.collection(COLLECTION_SCHEMA.registrations)
		.where('programYear', '==', PROGRAM_YEAR)
		.where('waitingList.active', '==', true)
		.where('waitingList.joinedOn', '<=', cutoff)
		.orderBy('waitingList.joinedOn')
		.orderBy('__name__');
export const enqueueWaitingListCampaign = async (
	campaignId: string,
	generation: number,
): Promise<void> => {
	await getFunctions(admin.app())
		.taskQueue<WaitingListWorkerRequest>(
			`locations/${FUNCTION_REGION}/functions/waitingListEmailWorker`,
		)
		.enqueue({ campaignId, generation });
};
export const campaignDate = (value: Timestamp | Date): Date =>
	value instanceof Date ? value : value.toDate();

const preview = async (): Promise<WaitingListCampaignPreview> => {
	const blockedReasons: string[] = [];
	const settings = await getWaitingListSettings();
	if (!settings.emailSendingEnabled)
		blockedReasons.push('Waiting-list email sending is disabled.');
	if (!(await waitingListSendingAllowed()))
		blockedReasons.push('Email delivery is disabled or unavailable.');
	try {
		requireOpenPreRegistration(await getPublicParameters());
	} catch {
		blockedReasons.push('Registration is currently closed.');
	}
	if (!(await hasWaitingListCapacity(await getBookingNow(admin.firestore()))))
		blockedReasons.push('No future appointments have capacity.');
	let emails: WaitingListEmailPreview[] = [];
	try {
		emails = await loadWaitingListEmails();
		if (Buffer.byteLength(JSON.stringify(emails), 'utf8') > 700_000) {
			emails = [];
			blockedReasons.push(
				'Waiting-list templates are too large. Use smaller templates.',
			);
		}
	} catch {
		blockedReasons.push('Publish English and Spanish waiting-list templates.');
	}
	const memberCount = (
		await activeWaitingListQuery(new Date()).count().get()
	).data().count;
	if (!memberCount) blockedReasons.push('The waiting list is empty.');
	return {
		memberCount,
		canSend: blockedReasons.length === 0,
		blockedReasons,
		emails,
	};
};

export const previewWaitingListCampaign = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListCampaignPreview> => {
	requireOwner(request);
	requireOnlyKeys(requireObject(request.data), []);
	return preview();
};

export const startWaitingListCampaign = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListCampaign> => {
	const actor = requireOwner(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'revisions']);
	const id = requireMutationId(data['mutationId']);
	const ref = campaignCollection().doc(id);
	const existing = await ref.get();
	if (existing.exists)
		return getWaitingListCampaign({ ...request, data: { campaignId: id } });
	const candidate = await preview();
	if (!candidate.canSend)
		throw new HttpsError(
			'failed-precondition',
			candidate.blockedReasons.join(' '),
		);
	const revisions = requireObject(data['revisions']);
	requireOnlyKeys(revisions, ['en', 'es']);
	if (
		candidate.emails.some((email) => {
			const expected = requireObject(revisions[email.language]);
			requireOnlyKeys(expected, ['templateKey', 'revisionId']);
			return (
				expected['revisionId'] !== email.revisionId ||
				expected['templateKey'] !== email.templateKey
			);
		})
	)
		throw new HttpsError(
			'aborted',
			'Templates changed. Preview the campaign again.',
		);
	// Never use production SES from normal emulator tests.
	const sendRate =
		process.env['FUNCTIONS_EMULATOR'] === 'true'
			? 1
			: await waitingListSendRate();
	const now = new Date();
	const memberCount = (await activeWaitingListQuery(now).count().get()).data()
		.count;
	const lock = campaignCollection().doc('_lock');
	await admin.firestore().runTransaction(async (transaction) => {
		const [snapshot, lockSnapshot] = await Promise.all([
			transaction.get(ref),
			transaction.get(lock),
		]);
		if (snapshot.exists) return;
		if (lockSnapshot.data()?.['campaignId'])
			throw new HttpsError(
				'failed-precondition',
				'Finish or resume the current waiting-list campaign first.',
			);
		transaction.create(ref, {
			programYear: PROGRAM_YEAR,
			actorUid: actor.uid,
			simulated: process.env['FUNCTIONS_EMULATOR'] === 'true',
			status: 'queued',
			createdAt: now,
			updatedAt: now,
			memberCount,
			emails: candidate.emails,
			sendRate,
			generation: 1,
		} satisfies StoredWaitingListCampaign);
		transaction.set(lock, { campaignId: id });
	});
	try {
		await enqueueWaitingListCampaign(id, 1);
	} catch {
		await ref.update({
			status: 'paused',
			message: 'The job was saved but could not start. Resume this campaign.',
			updatedAt: new Date(),
		});
	}
	return getWaitingListCampaign({ ...request, data: { campaignId: id } });
};

export const getWaitingListCampaign = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListCampaign> => {
	requireOwner(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['campaignId']);
	const id = requireMutationId(data['campaignId']);
	const ref = campaignCollection().doc(id);
	const snapshot = await ref.get();
	if (!snapshot.exists)
		throw new HttpsError('not-found', 'Campaign was not found.');
	const record = snapshot.data() as StoredWaitingListCampaign;
	const states = ['accepted', 'skipped', 'failed', 'uncertain'] as const;
	const counts = await Promise.all(
		states.map(
			async (state) =>
				(
					await ref
						.collection('deliveries')
						.where('state', '==', state)
						.count()
						.get()
				).data().count,
		),
	);
	return {
		id,
		simulated: record.simulated === true,
		programYear: record.programYear,
		status: record.status,
		createdAt: campaignDate(record.createdAt).toISOString(),
		updatedAt: campaignDate(record.updatedAt).toISOString(),
		memberCount: record.memberCount,
		accepted: counts[0],
		skipped: counts[1],
		failed: counts[2],
		uncertain: counts[3],
		...(record.message ? { message: record.message } : {}),
	};
};

export const listWaitingListCampaigns = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListCampaign[]> => {
	requireOwner(request);
	requireOnlyKeys(requireObject(request.data), []);
	const snapshot = await campaignCollection()
		.where('programYear', '==', PROGRAM_YEAR)
		.orderBy('createdAt', 'desc')
		.limit(10)
		.get();
	return Promise.all(
		snapshot.docs.map((doc) =>
			getWaitingListCampaign({ ...request, data: { campaignId: doc.id } }),
		),
	);
};

export const resumeWaitingListCampaign = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListCampaign> => {
	requireOwner(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['campaignId']);
	const id = requireMutationId(data['campaignId']);
	if (
		!(await getWaitingListSettings()).emailSendingEnabled ||
		!(await waitingListSendingAllowed())
	)
		throw new HttpsError(
			'failed-precondition',
			'Enable waiting-list email delivery before resuming.',
		);
	const ref = campaignCollection().doc(id);
	const generation = await admin
		.firestore()
		.runTransaction(async (transaction) => {
			const snapshot = await transaction.get(ref);
			if (!snapshot.exists)
				throw new HttpsError('not-found', 'Campaign was not found.');
			const record = snapshot.data() as StoredWaitingListCampaign;
			if (record.programYear !== PROGRAM_YEAR || record.status === 'completed')
				throw new HttpsError(
					'failed-precondition',
					'This campaign cannot be resumed.',
				);
			if (
				record.leaseUntil &&
				campaignDate(record.leaseUntil).valueOf() > Date.now()
			)
				throw new HttpsError(
					'failed-precondition',
					'The campaign is still running.',
				);
			transaction.update(ref, {
				status: 'queued',
				generation: record.generation + 1,
				updatedAt: new Date(),
				message: '',
			});
			return record.generation + 1;
		});
	try {
		await enqueueWaitingListCampaign(id, generation);
	} catch {
		await ref.update({
			status: 'paused',
			message: 'The job could not start. Resume this campaign.',
			updatedAt: new Date(),
		});
	}
	return getWaitingListCampaign(request);
};
