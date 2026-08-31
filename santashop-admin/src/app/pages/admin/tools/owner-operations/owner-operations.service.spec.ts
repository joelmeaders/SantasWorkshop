import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core';
import { OwnerOperationsService } from './owner-operations.service';

describe('OwnerOperationsService', () => {
	let service: OwnerOperationsService;
	let functions: Mocked<FunctionsWrapper>;

	beforeEach(() => {
		functions = {
			callableWrapper: vi
				.fn()
				.mockName('FunctionsWrapper.callableWrapper'),
		} as unknown as Mocked<FunctionsWrapper>;
		TestBed.configureTestingModule({
			providers: [
				OwnerOperationsService,
				{ provide: FunctionsWrapper, useValue: functions },
			],
		});
		service = TestBed.inject(OwnerOperationsService);
	});

	it('uses the preview callable with the typed request', async () => {
		const response = {
			previewId: 'preview-1',
			operation: 'yearly-reset' as const,
			projectId: 'test-project',
			programYear: 2025,
			expiresAt: '2026-07-30T12:10:00.000Z',
			confirmationPhrase: 'YEARLY RESET test-project 2025',
			counts: { users: 2 },
			seasonRestricted: true,
		};
		const callable = vi
			.fn()
			.mockName('previewCallable')
			.mockResolvedValue({ data: response });
		functions.callableWrapper.mockReturnValue(
			callable as unknown as ReturnType<
				FunctionsWrapper['callableWrapper']
			>,
		);

		const result = await service.preview({
			operation: 'yearly-reset',
			programYear: 2025,
		});

		expect(functions.callableWrapper).toHaveBeenCalledWith(
			'callablePreviewOwnerOperation',
		);
		expect(callable).toHaveBeenCalledWith({
			operation: 'yearly-reset',
			programYear: 2025,
		});
		expect(result).toEqual(response);
	});

	it('requests signed export URLs only by operation ID', async () => {
		const response = {
			url: 'https://storage.example/signed',
			expiresAt: '2026-07-30T12:15:00.000Z',
		};
		const callable = vi
			.fn()
			.mockName('exportCallable')
			.mockResolvedValue({ data: response });
		functions.callableWrapper.mockReturnValue(
			callable as unknown as ReturnType<
				FunctionsWrapper['callableWrapper']
			>,
		);

		const result = await service.getExportUrl('operation-1');

		expect(functions.callableWrapper).toHaveBeenCalledWith(
			'callableGetOwnerExportUrl',
		);
		expect(callable).toHaveBeenCalledWith({
			operationId: 'operation-1',
		});
		expect(result).toEqual(response);
	});

	it('starts and retrieves operations using only the supported operation request fields', async () => {
		const startCallable = vi
			.fn()
			.mockName('startCallable')
			.mockResolvedValue({ data: { operationId: 'operation-1', status: 'queued' } });
		const getCallable = vi
			.fn()
			.mockName('getCallable')
			.mockResolvedValue({
				data: {
					id: 'operation-1',
					operation: 'export-marketing-emails',
					status: 'succeeded',
					projectId: 'test-project',
					actorUid: 'owner-1',
					stage: 'completed',
					counts: {},
					progress: {},
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
				},
			});
		functions.callableWrapper
			.mockReturnValueOnce(
				startCallable as unknown as ReturnType<
					FunctionsWrapper['callableWrapper']
				>,
			)
			.mockReturnValueOnce(
				getCallable as unknown as ReturnType<
					FunctionsWrapper['callableWrapper']
				>,
			);

		await expect(
			service.start({
				previewId: 'preview-1',
				confirmationPhrase: 'EXPORT MARKETING EMAILS test-project',
			}),
		).resolves.toEqual({ operationId: 'operation-1', status: 'queued' });
		await expect(service.get('operation-1')).resolves.toMatchObject({
			id: 'operation-1',
			status: 'succeeded',
		});
		expect(functions.callableWrapper.mock.calls.map(([name]) => name)).toEqual([
			'callableStartOwnerOperation',
			'callableGetOwnerOperation',
		]);
		expect(startCallable).toHaveBeenCalledWith({
			previewId: 'preview-1',
			confirmationPhrase: 'EXPORT MARKETING EMAILS test-project',
		});
		expect(getCallable).toHaveBeenCalledWith({ operationId: 'operation-1' });
	});
});
