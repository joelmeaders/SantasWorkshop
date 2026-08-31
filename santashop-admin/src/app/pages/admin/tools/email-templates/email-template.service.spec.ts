import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core';
import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
	let service: EmailTemplateService;
	let functions: Mocked<FunctionsWrapper>;
	const callable = vi.fn();

	beforeEach(() => {
		callable.mockReset();
		functions = {
			callableWrapper: vi
				.fn()
				.mockName('FunctionsWrapper.callableWrapper')
				.mockReturnValue(callable),
		} as unknown as Mocked<FunctionsWrapper>;
		TestBed.configureTestingModule({
			providers: [
				EmailTemplateService,
				{ provide: FunctionsWrapper, useValue: functions },
			],
		});
		service = TestBed.inject(EmailTemplateService);
	});

	it('returns data from the list and detail callables', async () => {
		const list = [{ key: 'registration-2026', displayName: 'Registration' }];
		callable.mockResolvedValueOnce({ data: list });
		callable.mockResolvedValueOnce({
			data: { template: { key: 'registration-2026' }, revisions: [] },
		});

		await expect(service.listEmailTemplates()).resolves.toEqual(list);
		await expect(service.getEmailTemplate('registration-2026')).resolves.toMatchObject({
			template: { key: 'registration-2026' },
		});
		expect(functions.callableWrapper).toHaveBeenNthCalledWith(
			1,
			'callableListEmailTemplates',
		);
		expect(callable).toHaveBeenNthCalledWith(1, {});
		expect(functions.callableWrapper).toHaveBeenNthCalledWith(
			2,
			'callableGetEmailTemplate',
		);
		expect(callable).toHaveBeenNthCalledWith(2, { key: 'registration-2026' });
	});

	it('passes revision, publish, delete, and test-email payloads unchanged', async () => {
		callable.mockResolvedValue({ data: { ok: true } });
		const revisionRequest = {
			key: 'registration-2026',
			revisionId: 'rev-1',
		};
		const saveRequest = {
			key: 'registration-2026',
			deliveryProfile: 'registration-confirmation' as const,
			displayName: 'Registration confirmation',
			awsTemplateName: 'registration-2026',
			subjectPart: 'Hello {{firstName}}',
			html: '<p>Hello {{firstName}}</p>',
			fieldMappings: [],
		};
		const publishRequest = {
			key: 'registration-2026',
			revisionId: 'rev-2',
		};
		const testRequest = {
			key: 'registration-2026',
			deliveryProfile: 'registration-confirmation' as const,
			recipientEmail: 'preview@example.com',
			subjectPart: 'Hello {{firstName}}',
			html: '<p>Hello {{firstName}}</p>',
			fieldMappings: [],
		};

		await service.getEmailTemplateRevision(revisionRequest);
		await service.saveEmailTemplateRevision(saveRequest);
		await service.publishEmailTemplate(publishRequest);
		await service.deleteEmailTemplate('registration-2026');
		await service.sendTestEmailTemplate(testRequest);

		expect(functions.callableWrapper.mock.calls.map(([name]) => name)).toEqual([
			'callableGetEmailTemplateRevision',
			'callableSaveEmailTemplateRevision',
			'callablePublishEmailTemplate',
			'callableDeleteEmailTemplate',
			'callableSendTestEmailTemplate',
		]);
		expect(callable.mock.calls.map(([payload]) => payload)).toEqual([
			revisionRequest,
			saveRequest,
			publishRequest,
			{ key: 'registration-2026' },
			testRequest,
		]);
	});
});
