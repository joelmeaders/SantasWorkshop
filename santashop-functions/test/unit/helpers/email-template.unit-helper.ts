import { vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

export type EmailTemplateAdminMock = ReturnType<
	typeof createBackgroundAdminMock
>;

export const sesSendMock = vi.fn();

export const loadEmailTemplateHandlers = async (
	backgroundMock: EmailTemplateAdminMock,
): Promise<{
	callableListEmailTemplates: typeof import('../../../src/fn/callableListEmailTemplates').default;
	callableGetEmailTemplate: typeof import('../../../src/fn/callableGetEmailTemplate').default;
	callableGetEmailTemplateRevision: typeof import('../../../src/fn/callableGetEmailTemplateRevision').default;
	callableSaveEmailTemplateRevision: typeof import('../../../src/fn/callableSaveEmailTemplateRevision').default;
	callablePublishEmailTemplate: typeof import('../../../src/fn/callablePublishEmailTemplate').default;
}> => {
	vi.resetModules();
	sesSendMock.mockReset();
	vi.doMock('firebase-admin', () => backgroundMock.module);
	vi.doMock('@aws-sdk/client-ses', () => ({
		SESClient: class {
			public send = sesSendMock;
		},
		CreateTemplateCommand: class {
			constructor(public readonly input: unknown) {}
		},
		UpdateTemplateCommand: class {
			constructor(public readonly input: unknown) {}
		},
	}));

	const [
		listModule,
		getModule,
		getRevisionModule,
		saveModule,
		publishModule,
	] = await Promise.all([
		import('../../../src/fn/callableListEmailTemplates'),
		import('../../../src/fn/callableGetEmailTemplate'),
		import('../../../src/fn/callableGetEmailTemplateRevision'),
		import('../../../src/fn/callableSaveEmailTemplateRevision'),
		import('../../../src/fn/callablePublishEmailTemplate'),
	]);

	return {
		callableListEmailTemplates: listModule.default,
		callableGetEmailTemplate: getModule.default,
		callableGetEmailTemplateRevision: getRevisionModule.default,
		callableSaveEmailTemplateRevision: saveModule.default,
		callablePublishEmailTemplate: publishModule.default,
	};
};
