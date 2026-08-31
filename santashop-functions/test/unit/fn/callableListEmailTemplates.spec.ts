import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { loadEmailTemplateHandlers } from '../helpers/email-template.unit-helper';

describe('callableListEmailTemplates handler', () => {
	let backgroundMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
	});

	it('rejects non-admin callers', async () => {
		const { callableListEmailTemplates } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callableListEmailTemplates(
				createCallableRequest({}, { admin: false }),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('returns templates sorted by display name', async () => {
		const { callableListEmailTemplates } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('emailTemplates', [
			{
				id: 'reminder-2026',
				data: {
					key: 'reminder-2026',
					deliveryProfile: 'event-reminder',
					displayName: 'Z Reminder',
					subjectPart: 'Reminder',
					awsTemplateName: 'z-reminder',
					fieldMappings: [],
					createdOn: new Date(),
					updatedOn: new Date(),
				},
			},
			{
				id: 'registration-2026',
				data: {
					key: 'registration-2026',
					deliveryProfile: 'registration-confirmation',
					displayName: 'A Registration',
					subjectPart: 'Registration',
					awsTemplateName: 'a-registration',
					fieldMappings: [],
					createdOn: new Date(),
					updatedOn: new Date(),
				},
			},
		]);

		const result = await callableListEmailTemplates(
			createCallableRequest({}, { admin: true }),
		);

		expect(result.map((template) => template.displayName)).toEqual([
			'A Registration',
			'Z Reminder',
		]);
	});
});
