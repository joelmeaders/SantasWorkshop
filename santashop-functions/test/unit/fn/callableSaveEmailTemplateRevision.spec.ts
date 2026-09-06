import { beforeEach, describe, expect, it } from 'vitest';
import { createCallableRequest } from '../../helpers/callable-context';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import { loadEmailTemplateHandlers } from '../helpers/email-template.unit-helper';

describe('callableSaveEmailTemplateRevision handler', () => {
	let backgroundMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.setCollectionDocs('emailTemplates', []);
	});

	it('rejects non-admin callers', async () => {
		// Arrange
		const { callableSaveEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);

		// Act / Assert
		await expect(
			callableSaveEmailTemplateRevision(
				createCallableRequest(
					{
						key: 'registration-confirmation',
						deliveryProfile: 'registration-confirmation',
						displayName: 'Registration Confirmation',
						awsTemplateName: 'dscs-registration-confirmation-v1',
						subjectPart: 'Hello {{firstName}}',
						html: '<h1>Hello {{firstName}}</h1>',
						fieldMappings: [],
					},
					{ roles: [] },
				),
			),
		).rejects.toMatchObject({ code: 'permission-denied' });
	});

	it('stores html in Cloud Storage and writes template metadata', async () => {
		// Arrange
		const { callableSaveEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);

		// Act
		const result = await callableSaveEmailTemplateRevision(
			createCallableRequest(
				{
					key: 'registration-confirmation',
					deliveryProfile: 'registration-confirmation',
					displayName: 'Registration Confirmation',
					description: 'Main registration confirmation email',
					awsTemplateName: 'dscs-registration-confirmation-v1',
					subjectPart: 'Hello {{firstName}}',
					html: '<h1>Hello {{firstName}}</h1>',
					fieldMappings: [
						{
							name: 'firstName',
							mapping: 'firstName',
							sampleValue: 'Buddy',
						},
					],
					notes: 'Initial draft',
				},
				{ roles: ['admin', 'checkin'] },
			),
		);

		// Assert
		expect(result.revision.revisionNumber).toBe(1);
		expect(result.template.currentRevisionId).toBe(result.revision.id);
		expect(result.template.deliveryProfile).toBe(
			'registration-confirmation',
		);
		expect(
			backgroundMock.getFileRef(result.revision.htmlStoragePath).save,
		).toHaveBeenCalledWith('<h1>Hello {{firstName}}</h1>', {
			contentType: 'text/html; charset=utf-8',
			resumable: false,
		});
		expect(
			backgroundMock.getDocRef('emailTemplates/registration-confirmation')
				.set,
		).toHaveBeenCalledWith(
			expect.objectContaining({
				key: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				currentRevisionNumber: 1,
			}),
			undefined,
		);
	});

	it('deletes the uploaded html when metadata persistence fails', async () => {
		// Arrange
		const { callableSaveEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.runTransaction.mockRejectedValueOnce(
			new Error('firestore write failed'),
		);

		// Act / Assert
		await expect(
			callableSaveEmailTemplateRevision(
				createCallableRequest(
					{
						key: 'registration-confirmation',
						deliveryProfile: 'registration-confirmation',
						displayName: 'Registration Confirmation',
						awsTemplateName: 'dscs-registration-confirmation-v1',
						subjectPart: 'Hello {{firstName}}',
						html: '<h1>Hello {{firstName}}</h1>',
						fieldMappings: [
							{
								name: 'firstName',
								mapping: 'firstName',
								sampleValue: 'Buddy',
							},
						],
					},
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'internal' });

		expect(
			backgroundMock.getFileRef(
				'emailTemplates/registration-confirmation/revisions/generated-0.html',
			).delete,
		).toHaveBeenCalled();
	});

	it('rejects changing the AWS template name for an existing template', async () => {
		// Arrange
		const { callableSaveEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);
		backgroundMock.setDocSnapshot(
			'emailTemplates/registration-confirmation',
			{
				key: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				subjectPart: 'Hello {{firstName}}',
				awsTemplateName: 'dscs-registration-confirmation-v1',
				fieldMappings: [],
				currentRevisionId: 'rev-1',
				currentRevisionNumber: 1,
				createdOn: new Date(),
				updatedOn: new Date(),
			},
		);

		// Act / Assert
		await expect(
			callableSaveEmailTemplateRevision(
				createCallableRequest(
					{
						key: 'registration-confirmation',
						deliveryProfile: 'registration-confirmation',
						displayName: 'Registration Confirmation',
						awsTemplateName: 'dscs-registration-confirmation-v2',
						subjectPart: 'Hello {{firstName}}',
						html: '<h1>Hello {{firstName}}</h1>',
						fieldMappings: [
							{
								name: 'firstName',
								mapping: 'firstName',
								sampleValue: 'Buddy',
							},
						],
					},
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('maps invalid field mapping payloads to invalid-argument errors', async () => {
		const { callableSaveEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callableSaveEmailTemplateRevision(
				createCallableRequest(
					{
						key: 'registration-confirmation',
						deliveryProfile: 'registration-confirmation',
						displayName: 'Registration Confirmation',
						awsTemplateName: 'dscs-registration-confirmation-v1',
						subjectPart: 'Hello {{firstName}}',
						html: '<h1>Hello {{firstName}}</h1>',
						fieldMappings: {} as never,
					},
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('rejects unsupported Handlebars syntax before saving', async () => {
		const { callableSaveEmailTemplateRevision } =
			await loadEmailTemplateHandlers(backgroundMock);

		await expect(
			callableSaveEmailTemplateRevision(
				createCallableRequest(
					{
						key: 'registration-confirmation',
						deliveryProfile: 'registration-confirmation',
						displayName: 'Registration Confirmation',
						awsTemplateName: 'dscs-registration-confirmation-v1',
						subjectPart: 'Hello {{#if firstName}}there{{/if}}',
						html: '<h1>Hello {{firstName}}</h1>',
						fieldMappings: [
							{
								name: 'firstName',
								mapping: 'firstName',
								sampleValue: 'Buddy',
							},
						],
					},
					{ roles: ['admin', 'checkin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
	});

	it('saves language and review state, and protects imported keys and SES names', async () => {
		const { callableSaveEmailTemplateRevision: save } =
			await loadEmailTemplateHandlers(backgroundMock);
		const draft = {
			key: 'spanish-2026',
			language: 'es' as const,
			deliveryProfile: 'registration-confirmation' as const,
			displayName: 'Spanish',
			awsTemplateName: 'spanish-2026',
			subjectPart: 'Hola',
			html: '<p>Hola</p>',
			textPart: 'Hola',
			fieldMappings: [],
			seasonalReviewRequired: true,
			seasonalDetailsReviewed: false,
		};
		const result = await save(
			createCallableRequest(draft, { roles: ['admin'] }),
		);
		expect(result.revision).toMatchObject({
			language: 'es',
			textPart: 'Hola',
			seasonalReviewRequired: true,
			seasonalDetailsReviewed: false,
		});
		backgroundMock.setDocSnapshot('emailTemplates/spanish-2026', {
			...result.template,
		});
		await expect(
			save(
				createCallableRequest(
					{ ...draft, createOnly: true },
					{ roles: ['admin'] },
				),
			),
		).rejects.toMatchObject({ code: 'already-exists' });
		await expect(
			save(
				createCallableRequest(
					{ ...draft, language: 'en' },
					{ roles: ['admin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		await expect(
			save(
				createCallableRequest(
					{ ...draft, deliveryProfile: 'event-reminder' },
					{ roles: ['admin'] },
				),
			),
		).rejects.toMatchObject({ code: 'invalid-argument' });
		backgroundMock.setDocSnapshot('emailTemplateNames/occupied', {
			templateKey: 'another',
		});
		await expect(
			save(
				createCallableRequest(
					{ ...draft, key: 'new', awsTemplateName: 'occupied' },
					{ roles: ['admin'] },
				),
			),
		).rejects.toMatchObject({ code: 'already-exists' });
	});
});
