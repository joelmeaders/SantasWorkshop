import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNCTION_REGION } from '../../src/utility/function-region';

const setGlobalOptionsMock = vi.fn();
const onCallMock = vi.fn();
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

vi.mock('../../src/fn/sendNewRegistrationEmails2', () => ({
	default: sendNewRegistrationEmailsMock,
}));

describe('functions index exports', () => {
	beforeEach(() => {
		setGlobalOptionsMock.mockClear();
		onCallMock.mockClear();
		onDocumentCreatedMock.mockClear();
		onScheduleMock.mockClear();
		onTaskDispatchedMock.mockClear();
		sendNewRegistrationEmailsMock.mockClear();
		vi.resetModules();

		onCallMock.mockImplementation((options, handler) => ({
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

	it('uses the private Firebase IAM default for the task queue worker', async () => {
		const subject = await import('../../src/index');
		const worker = subject.ownerOperationWorker as unknown as {
			options: Record<string, unknown>;
		};

		expect(worker.options).not.toHaveProperty('invoker');
	});
});
