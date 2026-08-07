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
} from '@angular/router';
import { EmailTemplateEditorPage } from './email-template-editor.page';
import {
	createActivatedRouteMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
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
});
