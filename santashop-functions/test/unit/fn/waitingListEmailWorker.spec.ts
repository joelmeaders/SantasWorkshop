import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'firebase-functions/v2/tasks';
import type { WaitingListWorkerRequest } from '../../../src/fn/waitingListCampaigns';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

type Worker = (typeof import('../../../src/fn/waitingListEmailWorker'))['default'];
type AdminMock = ReturnType<typeof createBackgroundAdminMock>;
type RecordData = Record<string, unknown>;
const CAMPAIGN = 'waitingListCampaigns/recovery-campaign';
const MEMBERS = ['first', 'second', 'third'];
const receiptPath = (uid: string): string => `${CAMPAIGN}/deliveries/${uid}`;

interface Fixture {
	worker: Worker;
	adminMock: AdminMock;
	send: ReturnType<typeof vi.fn>;
	enqueue: ReturnType<typeof vi.fn>;
	quota: ReturnType<typeof vi.fn>;
	read: (path: string) => RecordData | undefined;
	write: (path: string, value: RecordData) => void;
	apply: (path: string, value: RecordData) => void;
	run: (generation?: number) => Promise<void>;
	resume: () => Promise<void>;
}

const setup = async (): Promise<Fixture> => {
	vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
	const adminMock = createBackgroundAdminMock();
	const documents = new Map<string, RecordData>();
	const read = (path: string): RecordData | undefined =>
		structuredClone(documents.get(path));
	const write = (path: string, value: RecordData): void => {
		documents.set(path, structuredClone(value));
	};
	const apply = (path: string, changes: RecordData): void => {
		const value = read(path);
		if (!value) throw new Error('Document is missing.');
		for (const [key, change] of Object.entries(changes)) {
			if (key === 'waitingList.active')
				(value['waitingList'] as RecordData)['active'] = change;
			else value[key] = change;
		}
		write(path, value);
	};
	// Reuse the shared Admin mock, adding persistence only for this fixture.
	for (const path of [
		CAMPAIGN,
		'waitingListCampaigns/_lock',
		...MEMBERS.flatMap((uid) => [
			receiptPath(uid), `registrations/${uid}`, `users/${uid}`,
		]),
	]) {
		const ref = adminMock.getDocRef(path);
		Object.assign(ref, {
			collection: (name: string): ReturnType<AdminMock['getCollectionRef']> =>
				adminMock.getCollectionRef(`${path}/${name}`),
		});
		ref.get.mockImplementation(async () => ({
			exists: documents.has(path),
			data: (): RecordData | undefined => read(path),
		}));
		ref.update.mockImplementation(async (...args: unknown[]): Promise<void> => {
			apply(path, args[0] as RecordData);
		});
		ref.create.mockImplementation(async (value: RecordData): Promise<void> => {
			if (documents.has(path)) throw new Error('Document already exists.');
			write(path, value);
		});
		ref.delete.mockImplementation(async (): Promise<void> => {
			documents.delete(path);
		});
	}
	write(CAMPAIGN, {
		programYear: 2025,
		status: 'queued',
		generation: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		memberCount: MEMBERS.length,
		// No real quota or SES request is made by these worker tests.
		sendRate: 1000,
		batch: MEMBERS.map((uid) => ({ uid, membershipId: `consent-${uid}` })),
		batchCursor: { joinedOn: new Date().toISOString(), uid: 'third' },
		emails: ['en', 'es'].map((language) => ({
			language, templateKey: `capacity-${language}`, revisionId: 'frozen-1',
			subject: 'Capacity', html: '<p>Capacity</p>', text: 'Capacity',
		})),
	});
	write('waitingListCampaigns/_lock', { campaignId: 'recovery-campaign' });
	for (const uid of MEMBERS) {
		write(`registrations/${uid}`, {
			programYear: 2025,
			waitingList: { active: true, membershipId: `consent-${uid}` },
		});
		write(`users/${uid}`, { emailAddress: `${uid}@example.com`, preferredLanguage: 'en' });
	}
	adminMock.setCollectionDocs('registrations', []);
	const send = vi.fn(async (email: string): Promise<string> => `message-${email}`);
	const enqueue = vi.fn().mockResolvedValue(undefined);
	const quota = vi.fn().mockResolvedValue(1000);
	vi.resetModules();
	vi.doMock('../../../src/firebase-admin', () => ({ default: adminMock.module }));
	vi.doMock('../../../src/models', () => ({
		customerLanguageOrEnglish: (value: unknown): 'en' | 'es' =>
			value === 'es' ? 'es' : 'en',
	}));
	vi.doMock('../../../src/utility/runtime-config', () => ({ PROGRAM_YEAR: 2025 }));
	vi.doMock('../../../src/utility/waiting-list-settings', () => ({
		getWaitingListSettings: async (): Promise<object> => ({ emailSendingEnabled: true }),
	}));
	vi.doMock('../../../src/utility/waiting-list-email', () => ({
		waitingListSendingAllowed: async (): Promise<boolean> => true,
		waitingListSendRate: quota,
		sendWaitingListEmail: send,
	}));
	vi.doMock('../../../src/fn/waitingListCampaigns', () => ({
		campaignCollection: (): ReturnType<AdminMock['getCollectionRef']> =>
			adminMock.getCollectionRef('waitingListCampaigns'),
		activeWaitingListQuery: (): ReturnType<AdminMock['getCollectionRef']> =>
			adminMock.getCollectionRef('registrations'),
		campaignDate: (value: Date): Date => value,
		enqueueWaitingListCampaign: enqueue,
	}));
	const { default: worker } = await vi.importActual<{ default: Worker }>(
		'../../../src/fn/waitingListEmailWorker',
	);
	const run = async (generation = 1): Promise<void> => {
		await worker({
			data: { campaignId: 'recovery-campaign', generation },
		} as Request<WaitingListWorkerRequest>);
	};
	const resume = async (): Promise<void> => {
		const campaign = read(CAMPAIGN)!;
		const generation = (campaign['generation'] as number) + 1;
		// Mirror the existing owner-only resume transition; never bypass it in the worker.
		apply(CAMPAIGN, { generation, status: 'queued', leaseToken: '', leaseUntil: new Date(0) });
		await run(generation);
	};
	return { worker, adminMock, send, enqueue, quota, read, write, apply, run, resume };
};

afterEach(() => {
	vi.unstubAllEnvs();
	for (const path of [
		'../../../src/firebase-admin', '../../../src/models',
		'../../../src/utility/runtime-config', '../../../src/utility/waiting-list-settings',
		'../../../src/utility/waiting-list-email', '../../../src/fn/waitingListCampaigns',
	]) vi.doUnmock(path);
});

const rejection = (name: string, status = 400): Error =>
	Object.assign(new Error('Provider rejected the request.'), {
		name, $metadata: { httpStatusCode: status },
	});

describe('waiting-list delivery recovery', () => {
	it.each([
		'AccountSendingPaused', 'Throttling', 'ThrottlingException',
		'AccessDenied', 'MailFromDomainNotVerified', 'MessageRejected',
	])('pauses on %s and retries only the rejected recipient after manual resume', async (name) => {
		const f = await setup();
		f.send.mockResolvedValueOnce('first-accepted').mockRejectedValueOnce(rejection(name));
		await f.run();
		expect(f.quota).toHaveBeenCalledTimes(1);
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused', generation: 1 });
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'accepted', providerMessageId: 'first-accepted' });
		expect(f.read(receiptPath('second'))).toMatchObject({ state: 'failed', retryable: true, rejectedGeneration: 1 });
		expect(f.read(receiptPath('third'))).toBeUndefined();
		expect(f.enqueue).not.toHaveBeenCalled();
		const accepted = f.read(receiptPath('first'));
		await f.run(); // Cloud Tasks redelivery cannot authorize a retry.
		expect(f.send).toHaveBeenCalledTimes(2);
		await f.resume();
		expect(f.read(receiptPath('first'))).toEqual(accepted);
		expect(f.read(receiptPath('second'))).toMatchObject({ state: 'accepted', retryable: false });
		expect(f.read(receiptPath('third'))).toMatchObject({ state: 'accepted' });
		expect(f.send.mock.calls.map((args) => args[0])).toEqual([
			'first@example.com', 'second@example.com', 'second@example.com', 'third@example.com',
		]);
		await f.run(2);
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'completed' });
	});

	it('requires a newer generation even when the worker crashed before writing paused', async () => {
		const f = await setup();
		f.write(receiptPath('first'), { state: 'failed', retryable: true, rejectedGeneration: 1 });
		await f.run();
		expect(f.send).not.toHaveBeenCalled();
		expect(f.enqueue).not.toHaveBeenCalled();
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused' });
	});

	it('makes at most one rejected provider request per explicit resume', async () => {
		const f = await setup();
		f.send.mockRejectedValue(rejection('Throttling'));
		await f.run();
		await f.run();
		expect(f.send).toHaveBeenCalledTimes(1);
		await f.resume();
		await f.run(2);
		expect(f.send).toHaveBeenCalledTimes(2);
		expect(f.read(receiptPath('second'))).toBeUndefined();
		expect(f.enqueue).not.toHaveBeenCalled();
	});

	it.each(['accepted', 'uncertain', 'failed', 'skipped'])('never retries existing terminal %s receipts', async (state) => {
		const f = await setup();
		for (const uid of MEMBERS) f.write(receiptPath(uid), { state });
		await f.resume();
		expect(f.send).not.toHaveBeenCalled();
		for (const uid of MEMBERS) expect(f.read(receiptPath(uid))).toEqual({ state });
	});

	it.each(['left', 'booked', 'rejoined'])('rechecks a rejected member who %s before resume', async (change) => {
		const f = await setup();
		f.send.mockRejectedValueOnce(rejection('AccountSendingPaused'));
		await f.run();
		const registration = f.read('registrations/first')!;
		if (change === 'left') (registration['waitingList'] as RecordData)['active'] = false;
		if (change === 'booked') registration['dateTimeSlot'] = { id: 'chosen' };
		if (change === 'rejoined') (registration['waitingList'] as RecordData)['membershipId'] = 'new-consent';
		f.write('registrations/first', registration);
		await f.resume();
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'skipped', retryable: false });
		expect(f.send.mock.calls.map((args) => args[0])).toEqual([
			'first@example.com', 'second@example.com', 'third@example.com',
		]);
	});

	it.each([408, 503, undefined])('pauses uncertain HTTP %s outcomes without retrying that recipient', async (status) => {
		const f = await setup();
		f.send.mockRejectedValueOnce(status === undefined ? new Error('Socket timeout') : rejection('Timeout', status));
		await f.run();
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused' });
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'uncertain', retryable: false });
		expect(f.read(receiptPath('second'))).toBeUndefined();
		await f.resume();
		expect(f.send.mock.calls.map((args) => args[0])).toEqual([
			'first@example.com', 'second@example.com', 'third@example.com',
		]);
	});

	it.each([true, false])('retries only receipt persistence when the first write committed=%s', async (committed) => {
		const f = await setup();
		const receipt = f.adminMock.getDocRef(receiptPath('first'));
		receipt.update.mockImplementationOnce(async (...args: unknown[]): Promise<void> => {
			if (committed) f.apply(receiptPath('first'), args[0] as RecordData);
			throw new Error('Firestore write response lost');
		});
		await f.run();
		expect(receipt.update).toHaveBeenCalledTimes(2);
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'accepted', providerMessageId: 'message-first@example.com' });
		expect(f.send.mock.calls.map((args) => args[0])).toEqual([
			'first@example.com', 'second@example.com', 'third@example.com',
		]);
	});

	it('never downgrades accepted when both persistence responses are lost', async () => {
		const f = await setup();
		const receipt = f.adminMock.getDocRef(receiptPath('first'));
		receipt.update.mockImplementation(async (...args: unknown[]): Promise<void> => {
			f.apply(receiptPath('first'), args[0] as RecordData);
			throw rejection('PersistenceError'); // Must not be classified as an SES 400.
		});
		await f.run();
		expect(receipt.update).toHaveBeenCalledTimes(2);
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused' });
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'accepted', providerMessageId: 'message-first@example.com' });
		expect(f.read(receiptPath('second'))).toBeUndefined();
		expect(f.send).toHaveBeenCalledTimes(1);
		const accepted = f.read(receiptPath('first'));
		await f.resume();
		expect(f.read(receiptPath('first'))).toEqual(accepted);
		expect(f.send).toHaveBeenCalledTimes(3);
	});

	it('pauses unresolved acceptance persistence and never repeats its provider request', async () => {
		const f = await setup();
		const receipt = f.adminMock.getDocRef(receiptPath('first'));
		receipt.update.mockRejectedValueOnce(new Error('Firestore unavailable'))
			.mockRejectedValueOnce(new Error('Firestore unavailable'));
		await f.run();
		expect(receipt.update).toHaveBeenCalledTimes(2);
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused' });
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'sending', retryable: false });
		expect(f.read(receiptPath('second'))).toBeUndefined();
		await f.resume();
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'uncertain', retryable: false });
		expect(f.send).toHaveBeenCalledTimes(3);
	});

	it('does not recreate a receipt deleted during acceptance persistence', async () => {
		const f = await setup();
		const receipt = f.adminMock.getDocRef(receiptPath('first'));
		f.send.mockImplementationOnce(async (): Promise<string> => {
			await receipt.delete();
			return 'accepted-before-delete';
		});
		await f.run();
		expect(receipt.update).toHaveBeenCalledTimes(2);
		expect(receipt.create).toHaveBeenCalledTimes(1);
		expect(f.read(receiptPath('first'))).toBeUndefined();
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused' });
		expect(f.send).toHaveBeenCalledTimes(1);
	});


	it('keeps a rejected request uncertain when its failure receipt could not be stored', async () => {
		const f = await setup();
		f.send.mockRejectedValueOnce(rejection('Throttling'));
		f.adminMock.getDocRef(receiptPath('first')).update
			.mockRejectedValueOnce(new Error('Firestore unavailable'));
		await f.run();
		expect(f.read(CAMPAIGN)).toMatchObject({ status: 'paused' });
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'sending' });
		expect(f.read(receiptPath('second'))).toBeUndefined();
		await f.resume();
		expect(f.read(receiptPath('first'))).toMatchObject({ state: 'uncertain' });
		expect(f.send).toHaveBeenCalledTimes(3);
	});

	it('ignores an old queued task after the owner advances the generation', async () => {
		const f = await setup();
		f.apply(CAMPAIGN, { generation: 2, status: 'queued' });
		await f.run(1);
		expect(f.send).not.toHaveBeenCalled();
		await f.run(2);
		expect(f.send).toHaveBeenCalledTimes(3);
	});

	it('keeps emulator delivery simulated while using the same acceptance persistence path', async () => {
		const f = await setup();
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		await f.run();
		expect(f.send).not.toHaveBeenCalled();
		expect(f.quota).not.toHaveBeenCalled();
		for (const uid of MEMBERS)
			expect(f.read(receiptPath(uid))).toMatchObject({ state: 'accepted', simulated: true });
	});
});
