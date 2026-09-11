import { seedPublicParameters } from '../../src/fn/testHelpers';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import type { DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

const sesSend = vi.fn();

vi.mock('@aws-sdk/client-ses', async (importOriginal) => ({
	...(await importOriginal<typeof import('@aws-sdk/client-ses')>()),
	SESClient: class {
		public send = sesSend;
	},
}));

import sendNewRegistrationEmails from '../../src/fn/sendRegistrationEmail';
import completeRegistration from '../../src/fn/completeRegistration';
import changeRegistrationDateTime from '../../src/fn/changeRegistrationDateTime';
import undoRegistration from '../../src/fn/undoRegistration';
import { COLLECTION_SCHEMA, EMAIL_TEMPLATE_KEYS } from '@santashop/models';
import { createRegistration, createUser } from '../fixtures/factories';
import { createCallableRequest } from '../helpers/callable-context';
import {
	clearEmulatorData,
	createTimestamp,
	getDocument,
	getFirestore,
	seedQrCode,
	setDocument,
} from '../helpers/admin-emulator';

describe.sequential('sendRegistrationEmail integration', () => {
	beforeAll(async () => {
		// Explicit handler calls are the only worker. A background create trigger
		// would consume the queue before this process's controlled SES transport.
		const hub = process.env['FIREBASE_EMULATOR_HUB'];
		expect(
			hub,
			'Run with firebase emulators:exec and no Functions emulator.',
		).toMatch(/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/u);
		const response = await fetch(`http://${hub}/emulators`, {
			signal: AbortSignal.timeout(5_000),
		});
		expect(response.ok).toBe(true);
		const emulators = await response.json();
		expect(emulators).not.toHaveProperty('functions');
	});

	afterEach(() => vi.unstubAllEnvs());

	beforeEach(async () => {
		vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
		vi.stubEnv('SANTASHOP_SEND_EMAILS_FROM_EMULATOR', 'true');
		sesSend.mockReset();
		sesSend.mockResolvedValue({
			MessageId: 'ses-message-1',
			$metadata: { httpStatusCode: 200 },
		});
		await clearEmulatorData();
		await getFirestore()
			.doc('_testConfig/emailSending')
			.set({ enabled: true });
		await getFirestore().doc('_testConfig/bookingClock').set({
			now: '2025-12-01T00:00:00.000Z',
		});
		await getFirestore()
			.doc('emailTemplates/confirmation/revisions/revision-1')
			.set({
				deliveryProfile: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
				fieldMappings: [
					{
						name: 'appointment',
						mapping: 'dateTime',
						sampleValue: 'preview only',
					},
					{
						name: 'ticket',
						mapping: 'code',
						sampleValue: 'preview only',
					},
					{
						name: 'qrImage',
						mapping: 'qrCodeUrl',
						sampleValue: 'preview only',
					},
				],
			});
		await setDocument(COLLECTION_SCHEMA.emailTemplates, 'confirmation', {
			key: 'confirmation',
			displayName: 'Published registration confirmation',
			deliveryProfile: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
			publishedOn: createTimestamp('2025-11-01T00:00:00.000Z'),
			awsTemplateName: 'confirmation-published',
			publishedRevisionId: 'revision-1',
			fieldMappings: [
				{ name: 'draftOnly', mapping: 'code', sampleValue: 'draft' },
			],
		});
	});

	const completeAndGetQueue = async (
		uid: string,
	): Promise<DocumentSnapshot> => {
		const qrCodeStoragePath = `registrations/${uid}/code.png`;
		await seedQrCode(qrCodeStoragePath);
		await Promise.all([
			setDocument(
				COLLECTION_SCHEMA.registrations,
				uid,
				createRegistration({ uid, qrCodeStoragePath }),
			),
			setDocument(
				COLLECTION_SCHEMA.users,
				uid,
				createUser({ emailAddress: 'BUDDY.ELF@example.com' }),
			),
			seedPublicParameters({
				registrationEnabled: true,
				admin: {
					preRegistrationEnabled: true,
					allowChangeRegistration: true,
					allowCancelRegistration: true,
				},
			}),
			setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-1', {
				programYear: 2025,
				enabled: true,
				maxSlots: 10,
				dateTime: createTimestamp('2025-12-10T18:00:00.000Z'),
			}),
		]);
		expect(
			await completeRegistration(
				createCallableRequest(
					{ mutationId: `complete-${uid}` },
					{ uid },
				),
			),
		).toBe(true);
		const queue = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.where('registrationUid', '==', uid)
			.get();
		expect(queue.size).toBe(1);
		const snapshot = queue.docs[0]!;
		expect(snapshot.data()).toMatchObject({
			registrationUid: uid,
			queueSource: 'registration-completion',
			templateKey: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
			appointmentSlotId: 'slot-1',
			code: 'ABCD2345',
			qrCodeStoragePath,
			email: 'buddy.elf@example.com',
			name: 'Buddy',
			deliveryState: 'queued',
		});
		return snapshot;
	};

	it('delivers the actual completion queue with published revision fields and matching registration status', async () => {
		const uid = 'completion-contract';
		const snapshot = await completeAndGetQueue(uid);
		const requestedOn = snapshot.data()![
			'deliveryRequestedOn'
		] as Timestamp;
		await sendNewRegistrationEmails(snapshot as never, {
			eventId: 'completion-contract-event',
		});

		expect(sesSend).toHaveBeenCalledOnce();
		const command = sesSend.mock.calls[0][0].input;
		expect(command).toMatchObject({
			Template: 'confirmation-published',
			Destination: { ToAddresses: ['buddy.elf@example.com'] },
		});
		const fields = JSON.parse(command.TemplateData);
		expect(fields).toMatchObject({
			firstName: 'Buddy',
			dateTime: 'Wednesday, December 10 at 11:00 AM',
			appointment: 'Wednesday, December 10 at 11:00 AM',
			code: 'ABCD2345',
			ticket: 'ABCD2345',
			qrImage: fields.qrCodeUrl,
		});
		expect(fields).not.toHaveProperty('draftOnly');
		const qrUrl = new URL(fields.qrCodeUrl);
		expect(decodeURIComponent(qrUrl.pathname)).toBe(
			`/v0/b/santas-workshop-test.appspot.com/o/registrations/${uid}/code.png`,
		);
		expect(qrUrl.searchParams.get('token')).toBe(
			'integration-download-token',
		);
		const queue = (await snapshot.ref.get()).data()!;
		expect(queue).toMatchObject({
			deliveryState: 'sent',
			deliveryAttemptCount: 1,
			deliveryProviderMessageId: 'ses-message-1',
			selectedTemplateKey: 'confirmation',
			selectedRevisionId: 'revision-1',
			failedOn: false,
		});
		expect(queue['deliveryProviderAcceptedOn'].toMillis()).toBeGreaterThan(
			0,
		);
		const registration = await getDocument<
			Record<string, Timestamp | false>
		>(COLLECTION_SCHEMA.registrations, uid);
		expect(registration).toMatchObject({
			reminderEmailQueuedOn: requestedOn,
			reminderEmailSentOn: queue['deliveryCompletedOn'],
			reminderEmailFailedOn: false,
		});
	});

	it('repairs registration status on replay after durable provider acceptance and a status-write failure without sending again', async () => {
		const uid = 'completion-status-retry';
		const snapshot = await completeAndGetQueue(uid);
		const db = getFirestore();
		const runTransaction = db.runTransaction.bind(db);
		const failure = new Error(
			'Injected registration delivery-status write failure',
		);
		// Keep the claim transaction real. Fail only the subsequent status write,
		// after the worker has persisted provider acceptance in real Firestore.
		const transactionSpy = vi
			.spyOn(db, 'runTransaction')
			.mockImplementationOnce(runTransaction)
			.mockImplementationOnce(async () => {
				const persisted = (await snapshot.ref.get()).data()!;
				expect(persisted).toMatchObject({
					deliveryProviderMessageId: 'ses-message-1',
					deliveryState: 'sent',
				});
				expect(
					persisted['deliveryProviderAcceptedOn'].toMillis(),
				).toBeGreaterThan(0);
				throw failure;
			});
		await expect(
			sendNewRegistrationEmails(snapshot as never, {
				eventId: 'status-retry-event',
			}),
		).rejects.toThrow(failure);
		transactionSpy.mockRestore();
		const accepted = (await snapshot.ref.get()).data()!;
		expect(
			await getDocument(COLLECTION_SCHEMA.registrations, uid),
		).toMatchObject({ reminderEmailSentOn: false });
		expect(sesSend).toHaveBeenCalledOnce();

		// Replay the original create snapshot, forcing the worker to reload its receipt.
		await sendNewRegistrationEmails(snapshot as never, {
			eventId: 'status-retry-event',
		});
		expect(sesSend).toHaveBeenCalledOnce();
		expect((await snapshot.ref.get()).data()).toMatchObject({
			deliveryState: 'sent',
			deliveryAttemptCount: 1,
			deliveryProviderMessageId: accepted['deliveryProviderMessageId'],
			deliveryProviderAcceptedOn: accepted['deliveryProviderAcceptedOn'],
			deliveryCompletedOn: accepted['deliveryCompletedOn'],
		});
		expect(
			await getDocument(COLLECTION_SCHEMA.registrations, uid),
		).toMatchObject({
			reminderEmailSentOn: accepted['deliveryCompletedOn'],
			reminderEmailQueuedOn: accepted['deliveryRequestedOn'],
			reminderEmailFailedOn: false,
		});
	});

	it.each(['reschedule', 'cancel'] as const)(
		'rejects the obsolete completion email after a real %s before dispatch',
		async (change) => {
			const uid = `completion-${change}`;
			const snapshot = await completeAndGetQueue(uid);
			if (change === 'reschedule') {
				await setDocument(COLLECTION_SCHEMA.dateTimeSlots, 'slot-2', {
					programYear: 2025,
					enabled: true,
					maxSlots: 10,
					dateTime: createTimestamp('2025-12-11T18:00:00.000Z'),
				});
				await changeRegistrationDateTime(
					createCallableRequest(
						{ mutationId: 'change-contract-1', slotId: 'slot-2' },
						{ uid },
					),
				);
			} else {
				await undoRegistration(
					createCallableRequest(
						{ mutationId: 'cancel-contract-1' },
						{ uid },
					),
				);
			}
			const registrationBeforeDispatch = await getDocument(
				COLLECTION_SCHEMA.registrations,
				uid,
			);
			await sendNewRegistrationEmails(snapshot as never);
			expect(sesSend).not.toHaveBeenCalled();
			expect((await snapshot.ref.get()).data()).toMatchObject({
				deliveryState: 'superseded',
				deliveryRequiresReviewReason:
					change === 'reschedule'
						? 'A newer appointment replaced this email.'
						: 'The registration is no longer active.',
			});
			expect(
				await getDocument(COLLECTION_SCHEMA.registrations, uid),
			).toEqual(registrationBeforeDispatch);
			const queues = await getFirestore()
				.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
				.where('registrationUid', '==', uid)
				.get();
			expect(queues.size).toBe(2);
			expect(
				queues.docs
					.find((document) => document.id !== snapshot.id)
					?.data(),
			).toMatchObject({ deliveryState: 'queued' });
		},
	);

	const seedDeletionRace = async (uid: string): Promise<DocumentSnapshot> => {
		const qrCodeStoragePath = `registrations/${uid}/code.png`;
		const queuedOn = createTimestamp('2025-12-01T01:00:00.000Z');
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.registrations, uid, {
			uid,
			qrcode: 'DELETE12',
			qrCodeStoragePath,
			firstName: 'Buddy',
			emailAddress: 'buddy.elf@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
			reminderEmailQueuedOn: queuedOn,
			reminderEmailSentOn: false,
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			`request-${uid}`,
			{
				registrationUid: uid,
				code: 'DELETE12',
				qrCodeStoragePath,
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-1',
				templateKey: 'confirmation',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
			},
		);
		return getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.doc(`request-${uid}`)
			.get();
	};

	it('does not recreate a deleted queue from a delayed creation snapshot', async () => {
		const uid = 'deleted-before-trigger';
		const snapshot = await seedDeletionRace(uid);
		const registrationRef = getFirestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(uid);
		await snapshot.ref.delete();
		await registrationRef.delete();

		await sendNewRegistrationEmails(snapshot as never);

		expect((await snapshot.ref.get()).exists).toBe(false);
		expect((await registrationRef.get()).exists).toBe(false);
		expect(sesSend).not.toHaveBeenCalled();
	});

	it('keeps an accepted send recorded without recreating its deleted queue or resending on replay', async () => {
		const uid = 'deleted-after-acceptance';
		const snapshot = await seedDeletionRace(uid);
		sesSend.mockImplementationOnce(async () => {
			await snapshot.ref.delete();
			return {
				MessageId: 'accepted-deleted-queue',
				$metadata: { httpStatusCode: 200 },
			};
		});

		await sendNewRegistrationEmails(snapshot as never, {
			eventId: 'deleted-queue-event',
		});

		expect((await snapshot.ref.get()).exists).toBe(false);
		const registration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			uid,
		);
		expect(registration?.['reminderEmailFailedOn']).toBe(false);
		const sentOn = registration?.['reminderEmailSentOn'] as Timestamp;
		expect(sentOn.toMillis()).toBeGreaterThan(0);

		await sendNewRegistrationEmails(snapshot as never, {
			eventId: 'deleted-queue-event',
		});

		expect(sesSend).toHaveBeenCalledOnce();
		expect((await snapshot.ref.get()).exists).toBe(false);
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				uid,
			),
		).toMatchObject({
			reminderEmailSentOn: sentOn,
			reminderEmailFailedOn: false,
		});
	});

	it('sends and marks queued registration emails as sent', async () => {
		const qrCodeStoragePath = 'registrations/queued-user-1/code.png';
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.registrations, 'queued-user-1', {
			uid: 'queued-user-1',
			qrcode: 'ABCD2345',
			qrCodeStoragePath,
			firstName: 'Buddy',
			emailAddress: 'buddy.elf@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'queued-user-1',
			{
				code: 'ABCD2345',
				qrCodeStoragePath,
				name: 'Buddy',
				email: 'buddy.elf@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				templateKey: 'confirmation',
			},
		);
		const snapshot = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.doc('queued-user-1')
			.get();

		await sendNewRegistrationEmails(snapshot as never);

		const queueDocument = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'queued-user-1',
		);
		expect(queueDocument).toMatchObject({
			deliveryState: 'sent',
			deliveryAttemptCount: 1,
			deliveryProviderMessageId: 'ses-message-1',
			deliveryProviderAcceptedOn: expect.anything(),
			deliveryCompletedOn: expect.anything(),
			failedOn: false,
		});
		expect(sesSend).toHaveBeenCalledOnce();
		expect(sesSend.mock.calls[0][0].input).toMatchObject({
			Destination: { ToAddresses: ['buddy.elf@example.com'] },
			Source: 'noreply@denversantaclausshop.org',
			ReturnPath: 'admin@denversantaclausshop.org',
			Template: 'confirmation-published',
		});
		expect(
			JSON.parse(sesSend.mock.calls[0][0].input.TemplateData),
		).toMatchObject({ firstName: 'Buddy', code: 'ABCD2345' });
		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.registrations,
				'queued-user-1',
			),
		).toMatchObject({ reminderEmailSentOn: expect.anything() });
	});

	it('does not let an accepted older send overwrite a newer delivery request', async () => {
		const uid = 'queued-user-race';
		const qrCodeStoragePath = `registrations/${uid}/code.png`;
		const queuedOn = createTimestamp('2025-12-01T01:00:00.000Z');
		const newerQueuedOn = createTimestamp('2025-12-01T02:00:00.000Z');
		await seedQrCode(qrCodeStoragePath);
		await setDocument(COLLECTION_SCHEMA.registrations, uid, {
			uid,
			qrcode: 'RACE1234',
			qrCodeStoragePath,
			firstName: 'Buddy',
			emailAddress: 'old@example.com',
			registrationSubmittedOn: createTimestamp(
				'2025-12-01T00:00:00.000Z',
			),
			dateTimeSlot: { id: 'slot-1' },
			reminderEmailQueuedOn: queuedOn,
			reminderEmailSentOn: false,
		});
		await setDocument(
			COLLECTION_SCHEMA.tmpRegistrationEmails,
			'request-race',
			{
				registrationUid: uid,
				code: 'RACE1234',
				qrCodeStoragePath,
				name: 'Buddy',
				email: 'old@example.com',
				formattedDateTime: 'Wednesday, December 10, 6:00 PM',
				appointmentSlotId: 'slot-1',
				templateKey: 'confirmation',
				deliveryRequestedOn: queuedOn,
				deliveryState: 'queued',
			},
		);
		sesSend.mockImplementationOnce(async () => {
			await getFirestore()
				.collection(COLLECTION_SCHEMA.registrations)
				.doc(uid)
				.set(
					{
						emailAddress: 'new@example.com',
						reminderEmailQueuedOn: newerQueuedOn,
						reminderEmailSentOn: false,
					},
					{ merge: true },
				);
			return {
				MessageId: 'accepted-race',
				$metadata: { httpStatusCode: 200 },
			};
		});
		const snapshot = await getFirestore()
			.collection(COLLECTION_SCHEMA.tmpRegistrationEmails)
			.doc('request-race')
			.get();

		await sendNewRegistrationEmails(snapshot as never);

		expect(
			await getDocument<Record<string, unknown>>(
				COLLECTION_SCHEMA.tmpRegistrationEmails,
				'request-race',
			),
		).toMatchObject({ deliveryState: 'sent' });
		const registration = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrations,
			uid,
		);
		expect(registration).toMatchObject({
			emailAddress: 'new@example.com',
			reminderEmailSentOn: false,
		});
		expect(
			(
				registration?.['reminderEmailQueuedOn'] as {
					toMillis: () => number;
				}
			).toMillis(),
		).toBe(newerQueuedOn.toMillis());
	});
});
