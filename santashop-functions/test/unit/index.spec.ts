import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNCTION_REGION } from '../../src/utility/function-region';

const setGlobalOptionsMock = vi.fn();
const onCallMock = vi.fn();
const onDocumentCreatedMock = vi.fn();
const onScheduleMock = vi.fn();
const onMessagePublishedMock = vi.fn();
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

vi.mock('firebase-functions/v2/pubsub', () => ({
	onMessagePublished: onMessagePublishedMock,
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
		onMessagePublishedMock.mockClear();
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
		onMessagePublishedMock.mockImplementation((options, handler) => ({
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
		});
	});

	it('does not call SES delivery from the Functions emulator by default', async () => {
		process.env.FUNCTIONS_EMULATOR = 'true';
		delete process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR;
		const subject = await import('../../src/index');
		const trigger = subject.sendNewRegistrationEmails as unknown as {
			options: { secrets: string[] };
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
		expect(trigger.options.secrets).toEqual([]);
	});

	it('allows an explicit emulator email-delivery integration run', async () => {
		process.env.FUNCTIONS_EMULATOR = 'true';
		process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR = 'true';
		const subject = await import('../../src/index');
		const trigger = subject.sendNewRegistrationEmails as unknown as {
			options: { secrets: string[] };
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
		expect(trigger.options.secrets).toEqual([
			'AWS_ACCESS_KEY_ID',
			'AWS_SECRET_ACCESS_KEY',
		]);
	});
});
