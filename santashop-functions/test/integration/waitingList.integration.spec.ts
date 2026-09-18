import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'firebase-functions/v2/tasks';
import {
	clearEmulatorData,
	getAdminApp,
	getFirestore,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';
import { createRegistration } from '../fixtures/factories';
import { seedPublicParameters } from '../../src/fn/testHelpers';
import {
	getWaitingListState,
	setWaitingListMembership,
} from '../../src/fn/waitingList';
import setDraftAppointment from '../../src/fn/setDraftAppointment';
import completeRegistration from '../../src/fn/completeRegistration';
import {
	readWaitingListSettings,
	publishWaitingListSettings,
} from '../../src/fn/waitingListSettings';
import waitingListEmailWorker from '../../src/fn/waitingListEmailWorker';
import {
	getWaitingListCampaign,
	resumeWaitingListCampaign,
	previewWaitingListCampaign,
	startWaitingListCampaign,
	type WaitingListWorkerRequest,
} from '../../src/fn/waitingListCampaigns';

const enqueue = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('firebase-admin/functions', () => ({
	getFunctions: (): object => ({ taskQueue: (): object => ({ enqueue }) }),
}));
const uid = 'waiting-customer';
const join = (
	mutationId = 'join-request-1',
	source = 'overview',
): ReturnType<typeof setWaitingListMembership> =>
	setWaitingListMembership(
		createCallableRequest({ active: true, mutationId, source }, { uid }),
	);
const membership = async (): Promise<Record<string, unknown>> =>
	(await getFirestore().doc(`registrations/${uid}`).get()).data()?.[
		'waitingList'
	];

describe.sequential('waiting list transactions and campaigns', () => {
	beforeEach(async () => {
		await clearEmulatorData();
		enqueue.mockResolvedValue(undefined);
		const draft = createRegistration({ uid, programYear: 2025 });
		delete draft.dateTimeSlot;
		await Promise.all([
			setDocument('registrations', uid, draft),
			setDocument('users', uid, {
				emailAddress: 'waiting@example.com',
				firstName: 'Maya',
				lastName: 'Tester',
				zipCode: '80205',
				preferredLanguage: 'es',
			}),
			setDocument('_testConfig', 'waitingList', {
				joiningEnabled: true,
				emailSendingEnabled: true,
			}),
			setDocument('_testConfig', 'bookingClock', {
				now: '2025-12-01T00:00:00Z',
			}),
			setDocument('_testConfig', 'emailSending', {
				enabled: true,
				simulateWaitingList: true,
			}),
			seedPublicParameters({
				registrationEnabled: true,
				admin: { preRegistrationEnabled: true },
			}),
		]);
	});

	it(
		'keeps first consent time on concurrent duplicates and permits opt-out with joining disabled',
		{ timeout: 30000 },
		async () => {
			await Promise.all([join(), join(), join('another-join', 'weather')]);
			const first = await membership();
			expect(first['active']).toBe(true);
			await join('another-duplicate');
			expect(await membership()).toEqual(first);
			await setDocument('_testConfig', 'waitingList', {
				joiningEnabled: false,
				emailSendingEnabled: false,
			});
			await setWaitingListMembership(
				createCallableRequest(
					{ active: false, mutationId: 'leave-request' },
					{ uid },
				),
			);
			expect(await membership()).toEqual({ ...first, active: false });
			await expect(join('disabled-join')).rejects.toMatchObject({
				code: 'failed-precondition',
			});
			await setDocument('_testConfig', 'waitingList', {
				joiningEnabled: true,
				emailSendingEnabled: false,
			});
			await join('fresh-opt-in', 'maintenance');
			expect(await membership()).toMatchObject({
				active: true,
				membershipId: 'fresh-opt-in',
				source: 'maintenance',
			});
		},
	);

	it('rejects identity overrides, missing consent, reused request IDs, and completed or selected registrations', async () => {
		await expect(
			setWaitingListMembership(
				createCallableRequest({
					active: true,
					mutationId: 'bad-request',
					source: 'overview',
					uid: 'other',
				}),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(
			setWaitingListMembership(
				createCallableRequest(
					{ mutationId: 'bad-request', source: 'overview' },
					{ uid },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await join();
		await expect(
			setWaitingListMembership(
				createCallableRequest(
					{ active: false, mutationId: 'join-request-1' },
					{ uid },
				),
			),
		).rejects.toMatchObject({ code: 'already-exists' });
		for (const change of [
			{ registrationSubmittedOn: new Date() },
			{ dateTimeSlot: { id: 'chosen' } },
		]) {
			await getFirestore().doc(`registrations/${uid}`).update(change);
			expect(
				(await getWaitingListState(createCallableRequest({}, { uid }))).canJoin,
			).toBe(false);
		}
	});

	it('counts only future current-year enabled slots with available counters', async () => {
		const slot = {
			programYear: 2025,
			dateTime: new Date('2025-12-10T18:00:00Z'),
			enabled: true,
			maxSlots: 2,
			slotsReserved: 0,
		};
		for (const change of [
			{ programYear: 2024 },
			{ dateTime: new Date('2025-01-01') },
			{ enabled: false },
			{ slotsReserved: 2 },
			{ slotsReserved: 3 },
		]) {
			await setDocument('dateTimeSlots', 'slot-1', { ...slot, ...change });
			expect(
				(await getWaitingListState(createCallableRequest({}, { uid }))).canJoin,
			).toBe(true);
		}
		await setDocument('dateTimeSlots', 'slot-1', slot);
		await expect(join()).rejects.toMatchObject({ code: 'failed-precondition' });
	});

	it('clears consent in booking and completion transactions without a separate membership write', async () => {
		await join();
		const first = await membership();
		await setDocument('dateTimeSlots', 'slot-1', {
			programYear: 2025,
			dateTime: new Date('2025-12-10T18:00:00Z'),
			enabled: true,
			maxSlots: 5,
			slotsReserved: 0,
		});
		await Promise.allSettled([
			join('concurrent-join'),
			setDraftAppointment(
				createCallableRequest(
					{
						mutationId: 'choose-appointment',
						slotId: 'slot-1',
						reviewedDateTime: '2025-12-10T18:00:00.000Z',
					},
					{ uid },
				),
			),
		]);
		expect(await membership()).toEqual({ ...first, active: false });
		// Simulate a legacy stale flag before the registration completion transaction.
		await getFirestore()
			.doc(`registrations/${uid}`)
			.update({ 'waitingList.active': true });
		await completeRegistration(
			createCallableRequest(
				{ mutationId: 'complete-waiting-customer' },
				{ uid },
			),
		);
		expect((await membership())['active']).toBe(false);
	});

	it('uses owner-only settings publication and rejects stale ETags', async () => {
		await expect(
			readWaitingListSettings(createCallableRequest({})),
		).rejects.toMatchObject({ code: 'permission-denied' });
		const old = await readWaitingListSettings(
			createCallableRequest({}, { owner: true }),
		);
		const request = createCallableRequest(
			{
				expectedEtag: old.etag,
				settings: { joiningEnabled: false, emailSendingEnabled: true },
			},
			{ owner: true },
		);
		await publishWaitingListSettings(request);
		await expect(publishWaitingListSettings(request)).rejects.toMatchObject({
			code: 'aborted',
		});
	});

	const seedCampaign = async (): Promise<void> => {
		await join();
		await setDocument('waitingListCampaigns', 'campaign-test', {
			programYear: 2025,
			actorUid: 'owner',
			status: 'queued',
			createdAt: new Date(Date.now() + 1000),
			updatedAt: new Date(),
			memberCount: 1,
			sendRate: 1,
			generation: 1,
			emails: ['en', 'es'].map((language) => ({
				language,
				subject: 'Capacity',
				html: '<p>Hello</p>',
				text: 'Hello',
				templateKey: `waiting-${language}`,
				revisionId: 'frozen-revision',
			})),
		});
		await setDocument('waitingListCampaigns', '_lock', {
			campaignId: 'campaign-test',
		});
	};

	const seedTemplates = async (): Promise<void> => {
		for (const language of ['en', 'es']) {
			const key = `capacity-${language}`;
			const path = `emailTemplates/${key}/revisions/rev-1.html`;
			await getAdminApp()
				.storage()
				.bucket()
				.file(path)
				.save(
					'<p>Hello {{firstName}}</p><a href="{{registrationUrl}}">Choose</a><a href="{{waitingListUrl}}">Manage</a>',
					{ resumable: false },
				);
			await getFirestore().doc(`emailTemplates/${key}`).set({
				key,
				displayName: key,
				language,
				deliveryProfile: 'waiting-list-capacity',
				publishedRevisionId: 'rev-1',
				publishedOn: new Date(),
				awsTemplateName: key,
			});
			await getFirestore()
				.doc(`emailTemplates/${key}/revisions/rev-1`)
				.set({
					id: 'rev-1',
					language,
					deliveryProfile: 'waiting-list-capacity',
					subjectPart: 'More times',
					textPart:
						'Hello {{firstName}} {{registrationUrl}} {{waitingListUrl}}',
					htmlStoragePath: path,
					fieldMappings: ['firstName', 'registrationUrl', 'waitingListUrl'].map(
						(name) => ({ name, mapping: name, sampleValue: 'sample' }),
					),
				});
		}
	};

	it('requires launch permissions and both published languages, freezes revisions, and excludes later subscribers', async () => {
		await join();
		await setDocument('dateTimeSlots', 'open-slot', {
			programYear: 2025,
			dateTime: new Date('2025-12-12T17:00:00Z'),
			enabled: true,
			maxSlots: 5,
			slotsReserved: 0,
		});
		expect(
			(
				await previewWaitingListCampaign(
					createCallableRequest({}, { owner: true }),
				)
			).canSend,
		).toBe(false);
		await seedTemplates();
		const preview = await previewWaitingListCampaign(
			createCallableRequest({}, { owner: true }),
		);
		expect(preview.blockedReasons).toEqual([]);
		expect(preview).toMatchObject({ canSend: true, memberCount: 1 });
		const revisions = Object.fromEntries(
			preview.emails.map((email) => [
				email.language,
				{ templateKey: email.templateKey, revisionId: email.revisionId },
			]),
		);
		await expect(
			startWaitingListCampaign(
				createCallableRequest(
					{
						mutationId: 'launch-test',
						revisions: {
							...revisions,
							en: { templateKey: 'different-key', revisionId: 'rev-1' },
						},
					},
					{ owner: true },
				),
			),
		).rejects.toMatchObject({ code: 'aborted' });
		await expect(
			startWaitingListCampaign(
				createCallableRequest({ mutationId: 'launch-test', revisions }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
		const campaign = await startWaitingListCampaign(
			createCallableRequest(
				{ mutationId: 'launch-test', revisions },
				{ owner: true },
			),
		);
		expect(campaign).toMatchObject({
			id: 'launch-test',
			status: 'queued',
			memberCount: 1,
			simulated: true,
		});
		await getFirestore()
			.doc('emailTemplates/capacity-es/revisions/rev-1')
			.update({ subjectPart: 'Changed later' });
		await getFirestore()
			.doc('dateTimeSlots/open-slot')
			.update({ slotsReserved: 5 });
		const later = {
			...(await getFirestore().doc(`registrations/${uid}`).get()).data(),
			uid: 'later-member',
			waitingList: {
				active: true,
				source: 'overview',
				membershipId: 'later-consent',
				joinedOn: new Date(Date.now() + 1000),
			},
		};
		await setDocument('registrations', 'later-member', later);
		await getFirestore()
			.doc(`users/${uid}`)
			.update({ preferredLanguage: 'en', firstName: 'Updated' });
		await waitingListEmailWorker({
			data: { campaignId: 'launch-test', generation: 1 },
		} as Request<WaitingListWorkerRequest>);
		await waitingListEmailWorker({
			data: { campaignId: 'launch-test', generation: 1 },
		} as Request<WaitingListWorkerRequest>);
		expect(
			(
				await getFirestore()
					.doc(`waitingListCampaigns/launch-test/deliveries/${uid}`)
					.get()
			).data(),
		).toMatchObject({ state: 'accepted', language: 'en', revisionId: 'rev-1' });
		expect(
			(
				await getFirestore()
					.doc('waitingListCampaigns/launch-test/deliveries/later-member')
					.get()
			).exists,
		).toBe(false);
		expect(
			(
				await getFirestore().doc('waitingListCampaigns/launch-test').get()
			).data()?.['emails'][1].subject,
		).toBe('More times');
		expect(
			(
				await startWaitingListCampaign(
					createCallableRequest(
						{ mutationId: 'launch-test', revisions },
						{ owner: true },
					),
				)
			).status,
		).toBe('completed');
	});

	it(
		'bounds each task to fifty members and advances the saved cursor to completion',
		{ timeout: 30000 },
		async () => {
			await seedCampaign();
			const batch = getFirestore().batch();
			for (let index = 0; index < 51; index++) {
				const id = `paged-${index.toString().padStart(3, '0')}`;
				batch.set(getFirestore().doc(`registrations/${id}`), {
					uid: id,
					programYear: 2025,
					waitingList: {
						active: true,
						joinedOn: new Date(Date.now() - 1000),
						source: 'overview',
						membershipId: id,
					},
				});
				batch.set(getFirestore().doc(`users/${id}`), {
					emailAddress: `${id}@example.com`,
					preferredLanguage: 'en',
				});
			}
			await batch.commit();
			await run();
			const deliveries = getFirestore().collection(
				'waitingListCampaigns/campaign-test/deliveries',
			);
			expect((await deliveries.count().get()).data().count).toBe(50);
			await run();
			expect((await deliveries.count().get()).data().count).toBe(52);
			await run();
			expect(
				(
					await getFirestore().doc('waitingListCampaigns/campaign-test').get()
				).data()?.['status'],
			).toBe('completed');
			expect(
				(await getFirestore().doc('waitingListCampaigns/_lock').get()).exists,
			).toBe(false);
		},
	);
	const run = (generation = 1): Promise<void> =>
		waitingListEmailWorker({
			data: { campaignId: 'campaign-test', generation },
		} as Request<WaitingListWorkerRequest>);
	const receipt = async (): Promise<Record<string, unknown> | undefined> =>
		(
			await getFirestore()
				.doc(`waitingListCampaigns/campaign-test/deliveries/${uid}`)
				.get()
		).data();

	it('simulates one accepted delivery, retains membership, and does not repeat it on retries', async () => {
		await seedCampaign();
		await run();
		expect(await receipt()).toMatchObject({
			state: 'accepted',
			simulated: true,
		});
		const first = await receipt();
		await run();
		await run();
		expect(await receipt()).toEqual(first);
		expect((await membership())['active']).toBe(true);
		expect(
			await getWaitingListCampaign(
				createCallableRequest({ campaignId: 'campaign-test' }, { owner: true }),
			),
		).toMatchObject({ status: 'completed', accepted: 1 });
	});

	it('pauses when a flag changes and resumes the same audience without repeating receipts', async () => {
		await seedCampaign();
		await setDocument('_testConfig', 'waitingList', {
			joiningEnabled: true,
			emailSendingEnabled: false,
		});
		await run();
		expect(await receipt()).toBeUndefined();
		expect(
			(
				await getFirestore().doc('waitingListCampaigns/campaign-test').get()
			).data()?.['status'],
		).toBe('paused');
		await setDocument('_testConfig', 'waitingList', {
			joiningEnabled: true,
			emailSendingEnabled: true,
		});
		await resumeWaitingListCampaign(
			createCallableRequest({ campaignId: 'campaign-test' }, { owner: true }),
		);
		await run(1); // An old task must not claim the resumed campaign.
		expect(await receipt()).toBeUndefined();
		await run(2);
		expect(await receipt()).toMatchObject({ state: 'accepted' });
	});

	it.each(['left', 'booked', 'registered', 'rejoined', 'uncertain'] as const)(
		'rechecks frozen batch member who %s before sending',
		async (change) => {
			await seedCampaign();
			await getFirestore()
				.doc('waitingListCampaigns/campaign-test')
				.update({
					batch: [{ uid, membershipId: 'join-request-1' }],
					batchCursor: { joinedOn: new Date().toISOString(), uid },
				});
			if (change === 'left')
				await getFirestore()
					.doc(`registrations/${uid}`)
					.update({ 'waitingList.active': false });
			if (change === 'booked')
				await getFirestore()
					.doc(`registrations/${uid}`)
					.update({ dateTimeSlot: { id: 'new-slot' } });
			if (change === 'registered')
				await getFirestore()
					.doc(`registrations/${uid}`)
					.update({ registrationSubmittedOn: new Date() });
			if (change === 'rejoined')
				await getFirestore()
					.doc(`registrations/${uid}`)
					.update({ 'waitingList.membershipId': 'later-consent' });
			if (change === 'uncertain')
				await getFirestore()
					.doc(`waitingListCampaigns/campaign-test/deliveries/${uid}`)
					.set({ state: 'sending' });
			await run();
			expect(await receipt()).toMatchObject({
				state: change === 'uncertain' ? 'uncertain' : 'skipped',
			});
			if (change === 'booked' || change === 'registered')
				expect((await membership())['active']).toBe(false);
		},
	);
});
