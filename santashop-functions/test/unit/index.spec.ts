import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNCTION_REGION } from '../../src/utility/function-region';

const setGlobalOptionsMock = vi.fn();
const onCallMock = vi.fn();
const onRequestMock = vi.fn();
const onDocumentCreatedMock = vi.fn();
const onScheduleMock = vi.fn();
const onTaskDispatchedMock = vi.fn();
const sendNewRegistrationEmailsMock = vi.fn();
const originalFunctionsEmulator = process.env.FUNCTIONS_EMULATOR;
const originalSendEmailsFromEmulator =
	process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR;

vi.mock('firebase-functions/v2/options', () => ({
	setGlobalOptions: setGlobalOptionsMock,
}));

vi.mock('firebase-functions/v2/https', () => ({
	HttpsError: class extends Error {},
	onCall: onCallMock,
	onRequest: onRequestMock,
}));

vi.mock('firebase-functions/v2/firestore', () => ({
	onDocumentCreated: onDocumentCreatedMock,
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
	onSchedule: onScheduleMock,
}));

vi.mock('firebase-functions/v2/tasks', () => ({
	onTaskDispatched: onTaskDispatchedMock,
}));

vi.mock('../../src/fn/sendRegistrationEmail', () => ({
	default: sendNewRegistrationEmailsMock,
}));

describe('functions index exports', () => {
	beforeEach(() => {
		setGlobalOptionsMock.mockClear();
		onCallMock.mockClear();
		onRequestMock.mockClear();
		onDocumentCreatedMock.mockClear();
		onScheduleMock.mockClear();
		onTaskDispatchedMock.mockClear();
		sendNewRegistrationEmailsMock.mockClear();
		vi.resetModules();

		onCallMock.mockImplementation((options, handler) => ({
			options,
			handler,
		}));
		onRequestMock.mockImplementation((options, handler) => ({
			options,
			handler,
		}));
		onDocumentCreatedMock.mockImplementation((options, handler) => ({
			options,
			handler,
		}));
		onScheduleMock.mockImplementation((options, handler) => ({
			options,
			handler,
		}));
		onTaskDispatchedMock.mockImplementation((options, handler) => ({
			options,
			handler,
		}));
	});

	afterEach(() => {
		if (originalFunctionsEmulator === undefined) {
			delete process.env.FUNCTIONS_EMULATOR;
		} else {
			process.env.FUNCTIONS_EMULATOR = originalFunctionsEmulator;
		}

		if (originalSendEmailsFromEmulator === undefined) {
			delete process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR;
		} else {
			process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR =
				originalSendEmailsFromEmulator;
		}
	});

	it('sets a shared explicit region for all exported functions', async () => {
		await import('../../src/index');

		expect(setGlobalOptionsMock).toHaveBeenCalledTimes(1);
		expect(setGlobalOptionsMock).toHaveBeenCalledWith({
			region: FUNCTION_REGION,
			...(process.env.SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT
				? {
						serviceAccount:
							process.env.SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT,
					}
				: {}),
		});
	});

	it('does not call SES delivery from the Functions emulator by default', async () => {
		process.env.FUNCTIONS_EMULATOR = 'true';
		delete process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR;
		const subject = await import('../../src/index');
		const trigger = subject.sendNewRegistrationEmails as unknown as {
			options: Record<string, unknown>;
			handler: (event: unknown) => Promise<void>;
		};

		await trigger.handler({
			id: 'emulator-event',
			data: {
				id: 'queued-email',
				ref: { path: 'tmp_registrationemails/queued-email' },
			},
		});

		expect(sendNewRegistrationEmailsMock).not.toHaveBeenCalled();
		expect(trigger.options).not.toHaveProperty('secrets');
	});

	it('allows an explicit emulator email-delivery integration run', async () => {
		process.env.FUNCTIONS_EMULATOR = 'true';
		process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR = 'true';
		const subject = await import('../../src/index');
		const trigger = subject.sendNewRegistrationEmails as unknown as {
			options: Record<string, unknown>;
			handler: (event: unknown) => Promise<void>;
		};
		const snapshot = {
			id: 'queued-email',
			ref: { path: 'tmp_registrationemails/queued-email' },
		};

		await trigger.handler({
			id: 'emulator-event',
			data: snapshot,
		});

		expect(sendNewRegistrationEmailsMock).toHaveBeenCalledWith(snapshot, {
			eventId: 'emulator-event',
		});
		expect(trigger.options).toMatchObject({
			document: 'tmp_registrationemails/{docId}',
			retry: true,
			concurrency: 5,
			maxInstances: 2,
			timeoutSeconds: 120,
		});
		expect(trigger.options).not.toHaveProperty('secrets');
	});

	it('does not bind SES credentials as provider-managed deployment secrets', async () => {
		delete process.env.FUNCTIONS_EMULATOR;
		const subject = await import('../../src/index');
		const exportedFunctions = [
			subject.sendNewRegistrationEmails,
			subject.callablePublishEmailTemplate,
			subject.callableSendTestEmailTemplate,
		] as unknown as Array<{ options: Record<string, unknown> }>;

		for (const exportedFunction of exportedFunctions) {
			expect(exportedFunction.options).not.toHaveProperty('secrets');
		}
	});

	it('isolates configuration readers and publisher without changing other callable identities', async () => {
		delete process.env.FUNCTIONS_EMULATOR;
		const subject = await import('../../src/index');
		const readers = [
			subject.completeRegistration,
			subject.saveDraftChild,
			subject.deleteDraftChild,
			subject.setDraftAppointment,
			subject.undoRegistration,
			subject.changeRegistrationDateTime,
			subject.readPublicParametersSettings,
		] as unknown as Array<{ options: Record<string, unknown> }>;
		for (const reader of readers)
			expect(reader.options.serviceAccount).toBe(
				process.env['SANTASHOP_REMOTE_CONFIG_READER_SERVICE_ACCOUNT'] ??
					'remote-config-reader@santas-workshop-test.iam.gserviceaccount.com',
			);
		expect(
			(
				subject.publishPublicParametersSettings as unknown as {
					options: Record<string, unknown>;
				}
			).options.serviceAccount,
		).toBe(
			process.env['SANTASHOP_REMOTE_CONFIG_PUBLISHER_SERVICE_ACCOUNT'] ??
				'remote-config-publisher@santas-workshop-test.iam.gserviceaccount.com',
		);
		expect(
			(
				subject.newAccount as unknown as {
					options: Record<string, unknown>;
				}
			).options,
		).not.toHaveProperty('serviceAccount');
	});

	it('exports password reset with bounded customer callable options', async () => {
		delete process.env.FUNCTIONS_EMULATOR;
		const subject = await import('../../src/index');
		const callable = subject.requestPasswordReset as unknown as {
			options: Record<string, unknown>;
		};

		expect(callable.options).toMatchObject({
			enforceAppCheck: true,
			concurrency: 10,
			maxInstances: 5,
			minInstances: 0,
			timeoutSeconds: 60,
		});
	});
	it('configures the public settings gateway as a singleton private reader endpoint', async () => {
		delete process.env.FUNCTIONS_EMULATOR;
		const subject = await import('../../src/index');
		const gateway = subject.publicParametersGateway as unknown as {
			options: Record<string, unknown>;
		};
		expect(gateway.options).toMatchObject({
			cpu: 1,
			concurrency: 80,
			maxInstances: 1,
			minInstances: 0,
			invoker:
				process.env['SANTASHOP_REMOTE_CONFIG_READER_SERVICE_ACCOUNT'] ??
				'remote-config-reader@santas-workshop-test.iam.gserviceaccount.com',
		});
		expect(onRequestMock).toHaveBeenCalledTimes(2);
		expect(
			(
				subject.emailIsolationProbe as unknown as {
					options: Record<string, unknown>;
				}
			).options,
		).toMatchObject({
			invoker: 'private',
			maxInstances: 1,
			minInstances: 0,
			concurrency: 1,
			timeoutSeconds: 30,
		});
	});
	it('does not attach Remote Config identities in the emulator', async () => {
		process.env.FUNCTIONS_EMULATOR = 'true';
		const subject = await import('../../src/index');
		for (const callable of [
			subject.completeRegistration,
			subject.readPublicParametersSettings,
			subject.publishPublicParametersSettings,
		] as unknown as Array<{ options: Record<string, unknown> }>)
			expect(callable.options).not.toHaveProperty('serviceAccount');
	});
	it('uses the private Firebase IAM default for the task queue worker', async () => {
		const subject = await import('../../src/index');
		const worker = subject.ownerOperationWorker as unknown as {
			options: Record<string, unknown>;
		};

		expect(worker.options).not.toHaveProperty('invoker');
	});
});
