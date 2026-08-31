import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { loadEmailTemplateHandlers } from '../helpers/email-template.unit-helper';

describe('callableGetEmailTemplateRevision handler', () => {
	let backgroundMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
	});

	it('returns the requested revision html', async () => {
		const { callableGetEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setDocSnapshot('emailTemplates/reminder-2026', {
			key: 'reminder-2026',
			deliveryProfile: 'event-reminder',
			displayName: 'Reminder 2026',
			subjectPart: 'Reminder {{eventName}}',
			awsTemplateName: 'reminder-2026',
			fieldMappings: [],
			currentRevisionId: 'rev-1',
			createdOn: new Date(),
			updatedOn: new Date(),
		});
		backgroundMock.setDocSnapshot(
			'emailTemplates/reminder-2026/revisions/rev-1',
			{
				id: 'rev-1',
				templateKey: 'reminder-2026',
				deliveryProfile: 'event-reminder',
				revisionNumber: 1,
				subjectPart: 'Reminder {{eventName}}',
				htmlStoragePath:
					'emailTemplates/reminder-2026/revisions/rev-1.html',
				htmlFileName: 'reminder-2026-r1.html',
				fieldMappings: [],
				createdOn: new Date(),
			},
		);
		backgroundMock.setFileContents(
			'emailTemplates/reminder-2026/revisions/rev-1.html',
			'<p>Reminder {{eventName}}</p>',
		);

		const result = await callableGetEmailTemplateRevision(
			createCallableRequest(
				{ key: 'reminder-2026', revisionId: 'rev-1' },
				{ admin: true },
			),
		);

		expect(result.revision.id).toBe('rev-1');
		expect(result.html).toContain('{{eventName}}');
	});

	it('maps invalid revision requests to invalid-argument errors', async () => {
		const { callableGetEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callableGetEmailTemplateRevision(
				createCallableRequest(
					{ key: 'reminder-2026', revisionId: '' },
					{ admin: true },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});
});
