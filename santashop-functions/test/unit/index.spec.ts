import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNCTION_REGION } from '../../src/utility/function-region';

const setGlobalOptionsMock = vi.fn();
const onCallMock = vi.fn();
const onDocumentCreatedMock = vi.fn();
const onScheduleMock = vi.fn();
const onMessagePublishedMock = vi.fn();

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

describe('functions index exports', () => {
	beforeEach(() => {
		setGlobalOptionsMock.mockClear();
		onCallMock.mockClear();
		onDocumentCreatedMock.mockClear();
		onScheduleMock.mockClear();
		onMessagePublishedMock.mockClear();
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

	it('sets a shared explicit region for all exported functions', async () => {
		await import('../../src/index');

		expect(setGlobalOptionsMock).toHaveBeenCalledTimes(1);
		expect(setGlobalOptionsMock).toHaveBeenCalledWith({
			region: FUNCTION_REGION,
		});
	});
});
