import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core';
import { OwnerOperationsService } from './owner-operations.service';

describe('OwnerOperationsService', () => {
	let service: OwnerOperationsService;
	let functions: jasmine.SpyObj<FunctionsWrapper>;

	beforeEach(() => {
		functions = jasmine.createSpyObj<FunctionsWrapper>('FunctionsWrapper', [
			'callableWrapper',
		]);
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
		const callable = jasmine
			.createSpy('previewCallable')
			.and.resolveTo({ data: response });
		functions.callableWrapper.and.returnValue(
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
		const callable = jasmine
			.createSpy('exportCallable')
			.and.resolveTo({ data: response });
		functions.callableWrapper.and.returnValue(
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
});
