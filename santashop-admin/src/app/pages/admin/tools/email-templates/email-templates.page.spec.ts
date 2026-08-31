import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmailTemplatesPage } from './email-templates.page';
import {
	provideActivatedRouteMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
} from '../../../../../test-helpers';
import { EmailTemplateService } from './email-template.service';

describe('EmailTemplatesPage', () => {
	let component: EmailTemplatesPage;
	let fixture: ComponentFixture<EmailTemplatesPage>;
	let emailTemplateService: Mocked<EmailTemplateService>;

	beforeEach(async () => {
		emailTemplateService = {
			listEmailTemplates: vi
				.fn()
				.mockName('EmailTemplateService.listEmailTemplates'),
		} as unknown as Mocked<EmailTemplateService>;
		emailTemplateService.listEmailTemplates.mockResolvedValue([
			{
				key: 'registration-2026',
				deliveryProfile: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				subjectPart: 'Hello {{eventName}}',
				awsTemplateName: 'dscs-registration-confirmation-v2',
				fieldMappings: [],
				currentRevisionId: 'rev-1',
				currentRevisionNumber: 1,
				createdOn: new Date(),
				updatedOn: new Date(),
			},
		]);

		await TestBed.configureTestingModule({
			imports: [EmailTemplatesPage],
			providers: [
				provideRouter([]),
				provideActivatedRouteMock(),
				provideAlertControllerMock(),
				provideLoadingControllerMock(),
				{
					provide: EmailTemplateService,
					useValue: emailTemplateService,
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EmailTemplatesPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		// Assert
		expect(component).toBeTruthy();
	});

	it('loads templates when the page enters', async () => {
		// Arrange

		// Act
		await component.ionViewWillEnter();

		// Assert
		expect(emailTemplateService.listEmailTemplates).toHaveBeenCalled();
	});

	it('maps delivery profile keys to friendly labels', () => {
		// Assert
		expect(
			component.deliveryProfileLabel({
				key: 'registration-2026',
				deliveryProfile: 'registration-confirmation',
				displayName: 'Registration Confirmation',
				subjectPart: 'Hello {{eventName}}',
				awsTemplateName: 'dscs-registration-confirmation-v2',
				fieldMappings: [],
				createdOn: new Date(),
				updatedOn: new Date(),
			}),
		).toBe('Registration confirmation');
	});
});
