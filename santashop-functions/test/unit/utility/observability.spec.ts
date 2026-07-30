import { beforeEach, describe, expect, it, vi } from 'vitest';

const { debugMock, infoMock, warnMock, errorMock } = vi.hoisted(() => ({
	debugMock: vi.fn(),
	infoMock: vi.fn(),
	warnMock: vi.fn(),
	errorMock: vi.fn(),
}));

vi.mock('firebase-functions/logger', () => ({
	debug: debugMock,
	info: infoMock,
	warn: warnMock,
	error: errorMock,
}));

import {
	createFunctionLogger,
	observeCallableHandler,
	observeDocumentHandler,
	observePubsubHandler,
	observeScheduledHandler,
} from '../../../src/utility/observability';

describe('observability utility', () => {
	beforeEach(() => {
		debugMock.mockReset();
		infoMock.mockReset();
		warnMock.mockReset();
		errorMock.mockReset();
	});

	it('adds function name and serialized error metadata to error logs', () => {
		const log = createFunctionLogger('winterTelemetry');
		const error = new Error('Snowstorm');

		log.error('Something drifted off the sleigh rails', { uid: 'elf-1' }, error);

		expect(errorMock).toHaveBeenCalledWith(
			'Something drifted off the sleigh rails',
			expect.objectContaining({
				functionName: 'winterTelemetry',
				uid: 'elf-1',
				errorMessage: 'Snowstorm',
				errorDetails: expect.stringContaining('Snowstorm'),
			}),
		);
	});

	it('logs callable invocation lifecycle with safe request metadata', async () => {
		const handler = observeCallableHandler(
			'callableSnowTest',
			async () => true,
		);

		const result = await handler({
			auth: {
				uid: 'admin-1',
				token: { admin: true },
			},
			data: { firstName: 'Buddy', password: 'super-secret' },
		} as never);

		expect(result).toBe(true);
		expect(infoMock).toHaveBeenNthCalledWith(
			1,
			'Function invocation started',
			expect.objectContaining({
				functionName: 'callableSnowTest',
				triggerType: 'callable',
				authUid: 'admin-1',
				isAdmin: true,
				dataType: 'object',
				dataKeys: ['firstName', 'password'],
			}),
		);
		expect(infoMock).toHaveBeenNthCalledWith(
			2,
			'Function invocation succeeded',
			expect.objectContaining({
				functionName: 'callableSnowTest',
				triggerType: 'callable',
				durationMs: expect.any(Number),
			}),
		);
	});

	it('logs callable failures and rethrows the original error', async () => {
		const handler = observeCallableHandler('callableFailureTest', async () => {
			throw new Error('No cocoa left');
		});

		await expect(handler({ auth: null, data: null } as never)).rejects.toThrow(
			'No cocoa left',
		);

		expect(errorMock).toHaveBeenCalledWith(
			'Function invocation failed',
			expect.objectContaining({
				functionName: 'callableFailureTest',
				triggerType: 'callable',
				errorMessage: 'No cocoa left',
				durationMs: expect.any(Number),
			}),
		);
	});

	it('logs firestore trigger metadata from the document snapshot context', async () => {
		const handler = observeDocumentHandler('firestoreAudit', async () => undefined);

		await handler({
			id: 'evt-1',
			params: { docId: 'reg-1' },
			data: {
				id: 'reg-1',
				ref: { path: 'tmp_registrationemails/reg-1' },
			},
		} as never);

		expect(infoMock).toHaveBeenNthCalledWith(
			1,
			'Function invocation started',
			expect.objectContaining({
				functionName: 'firestoreAudit',
				triggerType: 'firestore',
				eventId: 'evt-1',
				documentId: 'reg-1',
				documentPath: 'tmp_registrationemails/reg-1',
				paramKeys: ['docId'],
			}),
		);
	});

	it('logs scheduled and pubsub trigger metadata', async () => {
		const scheduledHandler = observeScheduledHandler(
			'scheduledAudit',
			async () => undefined,
		);
		const pubsubHandler = observePubsubHandler(
			'pubsubAudit',
			async () => undefined,
		);

		await scheduledHandler({
			id: 'schedule-1',
			scheduleTime: '2026-12-01T00:00:00.000Z',
		} as never);
		await pubsubHandler({
			id: 'pubsub-1',
			data: {
				message: {
					messageId: 'msg-1',
					publishTime: '2026-12-01T00:00:00.000Z',
					attributes: {
						job: 'queue-reminder-emails',
					},
				},
			},
		} as never);

		expect(infoMock).toHaveBeenCalledWith(
			'Function invocation started',
			expect.objectContaining({
				functionName: 'scheduledAudit',
				triggerType: 'scheduled',
				eventId: 'schedule-1',
				scheduleTime: '2026-12-01T00:00:00.000Z',
			}),
		);
		expect(infoMock).toHaveBeenCalledWith(
			'Function invocation started',
			expect.objectContaining({
				functionName: 'pubsubAudit',
				triggerType: 'pubsub',
				eventId: 'pubsub-1',
				messageId: 'msg-1',
				publishTime: '2026-12-01T00:00:00.000Z',
				attributeKeys: ['job'],
			}),
		);
	});
});
