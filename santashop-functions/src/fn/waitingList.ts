import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Transaction } from 'firebase-admin/firestore';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	WAITING_LIST_SOURCES,
	type Registration,
	type WaitingListSettings,
	type WaitingListSource,
	type WaitingListState,
} from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import { getBookingNow } from '../utility/booking-clock';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { getWaitingListSettings } from '../utility/waiting-list-settings';
import {
	requireObject,
	requireOnlyKeys,
	requireMutationId,
	MUTATION_RECEIPTS_SUBCOLLECTION,
} from './registrationMutationSupport';

export const waitingListEligibility = (
	registration: Registration | undefined,
	settings: WaitingListSettings,
	hasCapacity: boolean,
): WaitingListState => {
	const state = (reason: WaitingListState['reason']): WaitingListState => ({
		reason,
		active: reason === 'joined',
		canJoin: reason === 'eligible',
	});
	if (!registration || registration.programYear !== PROGRAM_YEAR)
		return state('account-unavailable');
	if (registration.registrationSubmittedOn || registration.hasCheckedIn)
		return state('registered');
	if (registration.dateTimeSlot) return state('appointment-selected');
	if (registration.waitingList?.active) return state('joined');
	if (!settings.joiningEnabled) return state('disabled');
	return state(hasCapacity ? 'capacity-available' : 'eligible');
};

/** Read schedule pages, never customers. Transactions also protect joining against slot edits. */
export const hasWaitingListCapacity = async (
	now: Date,
	transaction?: Transaction,
): Promise<boolean> => {
	const base = admin
		.firestore()
		.collection(COLLECTION_SCHEMA.dateTimeSlots)
		.where('programYear', '==', PROGRAM_YEAR)
		.where('enabled', '==', true)
		.where('dateTime', '>', now)
		.orderBy('dateTime')
		.limit(50);
	let query = base;
	for (;;) {
		const page = transaction ? await transaction.get(query) : await query.get();
		if (
			page.docs.some((doc) => {
				const slot = doc.data();
				return (
					Number.isFinite(slot['maxSlots']) &&
					(slot['slotsReserved'] ?? 0) < slot['maxSlots']
				);
			})
		)
			return true;
		if (page.size < 50) return false;
		query = base.startAfter(page.docs[page.docs.length - 1]);
	}
};

export const getWaitingListState = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListState> => {
	const uid = requireAuthenticatedUid(request);
	requireOnlyKeys(requireObject(request.data), []);
	const [snapshot, settings] = await Promise.all([
		admin.firestore().doc(`${COLLECTION_SCHEMA.registrations}/${uid}`).get(),
		getWaitingListSettings(),
	]);
	const registration = snapshot.data() as Registration | undefined;
	const initial = waitingListEligibility(registration, settings, false);
	if (!initial.canJoin) return initial;
	return waitingListEligibility(
		registration,
		settings,
		await hasWaitingListCapacity(await getBookingNow(admin.firestore())),
	);
};

export const setWaitingListMembership = async (
	request: CallableRequest<unknown>,
): Promise<true> => {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['active', 'mutationId', 'source']);
	if (typeof data['active'] !== 'boolean')
		throw new HttpsError(
			'invalid-argument',
			'Choose whether to join or leave.',
		);
	const active = data['active'];
	const mutationId = requireMutationId(data['mutationId']);
	const source = data['source'] as WaitingListSource;
	if (active && !WAITING_LIST_SOURCES.includes(source))
		throw new HttpsError('invalid-argument', 'Waiting list source is invalid.');
	const signature = JSON.stringify({ active, source: active ? source : null });
	const db = admin.firestore();
	const ref = db.doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);
	const receiptRef = ref
		.collection(MUTATION_RECEIPTS_SUBCOLLECTION)
		.doc(mutationId);
	const settings = await getWaitingListSettings();
	const now = await getBookingNow(db);
	await db.runTransaction(async (transaction) => {
		const [snapshot, receipt] = await Promise.all([
			transaction.get(ref),
			transaction.get(receiptRef),
		]);
		if (receipt.exists) {
			if (
				receipt.data()?.['operation'] !== 'setWaitingListMembership' ||
				receipt.data()?.['signature'] !== signature
			)
				throw new HttpsError(
					'already-exists',
					'This request ID was used for another action.',
				);
			return;
		}
		const registration = snapshot.data() as Registration | undefined;
		if (!registration)
			throw new HttpsError(
				'not-found',
				'Account registration record is unavailable.',
			);
		if (active) {
			const initial = waitingListEligibility(registration, settings, false);
			if (!initial.active) {
				if (
					!initial.canJoin ||
					(await hasWaitingListCapacity(now, transaction))
				)
					throw new HttpsError(
						'failed-precondition',
						'The waiting list is not available for this account.',
						{ reason: initial.canJoin ? 'capacity-available' : initial.reason },
					);
				transaction.update(ref, {
					waitingList: {
						active: true,
						joinedOn: new Date(),
						source,
						membershipId: mutationId,
					},
				});
			}
		} else if (registration.waitingList?.active) {
			transaction.update(ref, { 'waitingList.active': false });
		}
		transaction.create(receiptRef, {
			operation: 'setWaitingListMembership',
			signature,
			result: true,
			completedOn: now,
		});
	});
	return true;
};
