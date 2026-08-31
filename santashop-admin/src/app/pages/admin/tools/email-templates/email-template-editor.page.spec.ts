import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	ActivatedRoute,
	convertToParamMap,
	provideRouter,
	Router,
} from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { EmailTemplateEditorPage } from './email-template-editor.page';
import {
	createActivatedRouteMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
	requireDefined,
} from '../../../../../test-helpers';
import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateEditorPage', () => {
	let component: EmailTemplateEditorPage;
	let fixture: ComponentFixture<EmailTemplateEditorPage>;
	let emailTemplateService: Mocked<EmailTemplateService>;

	beforeEach(async () => {
		emailTemplateService = {
			getEmailTemplate: vi
				.fn()
				.mockName('EmailTemplateService.getEmailTemplate'),
			getEmailTemplateRevision: vi
				.fn()
				.mockName('EmailTemplateService.getEmailTemplateRevision'),
			saveEmailTemplateRevision: vi
				.fn()
				.mockName('EmailTemplateService.saveEmailTemplateRevision'),
			publishEmailTemplate: vi
				.fn()
				.mockName('EmailTemplateService.publishEmailTemplate'),
			deleteEmailTemplate: vi
				.fn()
				.mockName('EmailTemplateService.deleteEmailTemplate'),
			sendTestEmailTemplate: vi
				.fn()
				.mockName('EmailTemplateService.sendTestEmailTemplate'),
		} as unknown as Mocked<EmailTemplateService>;
		emailTemplateService.getEmailTemplate.mockResolvedValue({
			template: {
				key: 'registration-confirmation',
				deliveryProfile: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				subjectPart: 'Ticket for {{eventName}}',
				awsTemplateName: 'dscs-registration-confirmation-v1',
				fieldMappings: [
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: 'Buddy',
					},
				],
				currentRevisionId: 'rev-1',
				currentRevisionNumber: 1,
				createdOn: new Date(),
				updatedOn: new Date(),
			},
			revisions: [
				{
					id: 'rev-1',
					templateKey: 'registration-confirmation',
					deliveryProfile: 'registration-confirmation',
					revisionNumber: 1,
					subjectPart: 'Ticket for {{eventName}}',
					htmlStoragePath:
						'emailTemplates/registration-confirmation/revisions/rev-1.html',
					htmlFileName: 'registration-confirmation-revision-1.html',
					fieldMappings: [
						{
							name: 'firstName',
							mapping: 'firstName',
							sampleValue: 'Buddy',
						},
					],
					createdOn: new Date(),
				},
			],
			currentHtml: '<h1>Hello {{firstName}}</h1>',
		});
		emailTemplateService.sendTestEmailTemplate.mockResolvedValue({
			recipientEmail: 'preview@example.com',
			renderedSubject: 'Ticket for Toy Drive',
			renderedHtml: '<h1>Hello Buddy</h1>',
		});

		const routeMock = createActivatedRouteMock();
		routeMock.snapshot = {
			...routeMock.snapshot,
			paramMap: convertToParamMap({
				key: 'registration-confirmation',
			}),
		} as NonNullable<ActivatedRoute['snapshot']>;

		await TestBed.configureTestingModule({
			imports: [EmailTemplateEditorPage],
			providers: [
				provideRouter([]),
				{ provide: ActivatedRoute, useValue: routeMock },
				provideAlertControllerMock(),
				provideLoadingControllerMock(),
				{
					provide: EmailTemplateService,
					useValue: emailTemplateService,
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EmailTemplateEditorPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		// Assert
		expect(component).toBeTruthy();
	});

	it('loads the template details when entering the page', async () => {
		// Act
		await component.ionViewWillEnter();

		// Assert
		expect(emailTemplateService.getEmailTemplate).toHaveBeenCalledWith(
			'registration-confirmation',
		);
	});

	it('merges subject placeholders into the runtime field mapping list', async () => {
		// Act
		await component.ionViewWillEnter();

		// Assert
		expect(component.fieldMappings).toHaveLength(2);
		expect(component.fieldMappings.at(0).value).toEqual(
			expect.objectContaining({
				name: 'firstName',
				mapping: 'firstName',
			}),
		);
		expect(component.fieldMappings.at(1).value).toEqual(
			expect.objectContaining({
				name: 'eventName',
				mapping: 'eventName',
			}),
		);
	});

	it('sends a test email using the current draft and detected field values', async () => {
		// Arrange
		await component.ionViewWillEnter();
		component.testEmailForm.controls['recipientEmail'].setValue(
			'preview@example.com',
		);

		// Act
		await component.sendTestEmail();

		// Assert
		expect(emailTemplateService.sendTestEmailTemplate).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientEmail: 'preview@example.com',
				deliveryProfile: 'registration-confirmation',
				subjectPart: 'Ticket for {{eventName}}',
			}),
		);
	});

	it('loads a selected historical revision into the editable draft', async () => {
		await component.ionViewWillEnter();
		const revision = component.revisions[0];
		emailTemplateService.getEmailTemplateRevision.mockResolvedValue({
			template: requireDefined(component.currentTemplate),
			revision: {
				...revision,
				id: 'rev-2',
				revisionNumber: 2,
				subjectPart: 'Updated {{firstName}}',
			},
			html: '<p>Updated {{firstName}}</p>',
		});

		await component.loadRevision(revision);

		expect(emailTemplateService.getEmailTemplateRevision).toHaveBeenCalledWith({
			key: 'registration-confirmation',
			revisionId: 'rev-1',
		});
		expect(component.selectedRevisionId).toBe('rev-2');
		expect(component.form.controls['subjectPart'].value).toBe(
			'Updated {{firstName}}',
		);
		expect(component.html).toBe('<p>Updated {{firstName}}</p>');
	});

	it('normalizes field mappings to the selected delivery profile and refreshes preview HTML', async () => {
		await component.ionViewWillEnter();
		component.form.controls['deliveryProfile'].setValue('event-reminder');
		requireDefined(component.fieldMappings.at(0).get('mapping'))
			.setValue('unsupported.field');

		component.onDeliveryProfileChanged();

		expect(requireDefined(component.fieldMappings.at(0).get('mapping')).value).toBe(
			'firstName',
		);
		expect(component.previewHtml).toContain('Buddy');
	});

	it('saves a valid draft and updates the current template revision', async () => {
		await component.ionViewWillEnter();
		const template = {
			...requireDefined(component.currentTemplate),
			currentRevisionId: 'rev-2',
			currentRevisionNumber: 2,
		};
		const revision = {
			...component.revisions[0],
			id: 'rev-2',
			revisionNumber: 2,
		};
		emailTemplateService.saveEmailTemplateRevision.mockResolvedValue({
			template,
			revision,
			html: '<h1>Hello {{firstName}}</h1>',
		});
		component.form.controls['notes'].setValue('Updated copy');

		await component.saveRevision();

		expect(emailTemplateService.saveEmailTemplateRevision).toHaveBeenCalledWith(
			expect.objectContaining({
				key: 'registration-confirmation',
				html: '<h1>Hello {{firstName}}</h1>',
				notes: 'Updated copy',
			}),
		);
		expect(component.currentTemplate?.currentRevisionId).toBe('rev-2');
		expect(component.revisions[0].id).toBe('rev-2');
	});

	it('publishes the selected revision and marks it as current', async () => {
		await component.ionViewWillEnter();
		const template = {
			...requireDefined(component.currentTemplate),
			publishedRevisionId: 'rev-1',
			publishedRevisionNumber: 1,
		};
		emailTemplateService.publishEmailTemplate.mockResolvedValue({
			template,
			revision: component.revisions[0],
			renderedHtml: '<h1>Hello Buddy</h1>',
		});

		await component.publishTemplate();

		expect(emailTemplateService.publishEmailTemplate).toHaveBeenCalledWith({
			key: 'registration-confirmation',
			revisionId: 'rev-1',
		});
		expect(component.currentTemplate?.publishedRevisionId).toBe('rev-1');
	});

	it('marks validation failures before attempting to send or save', async () => {
		await component.sendTestEmail();
		expect(emailTemplateService.sendTestEmailTemplate).not.toHaveBeenCalled();

		await component.saveRevision();
		expect(emailTemplateService.saveEmailTemplateRevision).not.toHaveBeenCalled();
	});

	it('sets up a blank editable draft when the route has no template key', async () => {
		const route = TestBed.inject(ActivatedRoute);
		(route.snapshot as { paramMap: ReturnType<typeof convertToParamMap> }).paramMap =
			convertToParamMap({});

		await component.ionViewWillEnter();

		expect(component.isCreateMode$.value).toBe(true);
		expect(component.form.controls['key'].enabled).toBe(true);
		expect(component.revisions).toEqual([]);
		expect(component.previewHtml).toBe('');
	});

	it('uses the published revision badge and shows service failures to the user', async () => {
		await component.ionViewWillEnter();
		component.currentTemplate = {
			...requireDefined(component.currentTemplate),
			publishedRevisionId: 'rev-1',
		};
		expect(component.revisionBadgeColor(requireDefined(component.revisions[0]))).toBe('success');
		expect(
			component.revisionBadgeColor({ ...requireDefined(component.revisions[0]), id: 'rev-2' }),
		).toBe('medium');

		emailTemplateService.publishEmailTemplate.mockRejectedValueOnce(
			new Error('SES unavailable'),
		);
		await component.publishTemplate();
		const alerts = TestBed.inject(AlertController) as Mocked<AlertController>;
		expect(alerts.create).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'Something went wrong',
				message: 'SES unavailable',
			}),
		);
	});

	it('deletes a confirmed saved template and routes back to the template list', async () => {
		await component.ionViewWillEnter();
		const alerts = TestBed.inject(AlertController) as Mocked<AlertController>;
		const confirmation = {
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'destructive' }),
		};
		const deleted = {
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue(undefined),
		};
		alerts.create.mockResolvedValueOnce(
			confirmation as unknown as HTMLIonAlertElement,
		);
		alerts.create.mockResolvedValueOnce(deleted as unknown as HTMLIonAlertElement);
		emailTemplateService.deleteEmailTemplate.mockResolvedValue(undefined);
		const router = TestBed.inject(Router);
		const navigate = vi.spyOn(router, 'navigate');

		await component.deleteTemplate();

		expect(emailTemplateService.deleteEmailTemplate).toHaveBeenCalledWith(
			'registration-confirmation',
		);
		expect(navigate).toHaveBeenCalledWith(['/admin/email-templates']);
	});
});
