import { AsyncPipe } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	ViewChild,
	inject,
} from '@angular/core';
import {
	ReactiveFormsModule,
	UntypedFormArray,
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type {
	EmailTemplateDetail,
	EmailTemplateDeliveryProfile,
	EmailTemplateFieldDefinition,
	EmailTemplateRevision,
	EmailTemplateSummary,
	SaveEmailTemplateRevisionRequest,
	SendTestEmailTemplateRequest,
} from '@santashop/models';
import {
	EMAIL_TEMPLATE_DELIVERY_PROFILES as DELIVERY_PROFILES,
	EMAIL_TEMPLATE_RUNTIME_FIELDS as RUNTIME_FIELDS,
} from '@santashop/models';
import {
	AlertController,
	IonBadge,
	IonButton,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonContent,
	IonIcon,
	IonInput,
	IonItem,
	IonLabel,
	IonList,
	IonNote,
	IonSelect,
	IonSelectOption,
	IonTextarea,
	LoadingController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
	cloudUploadOutline,
	documentTextOutline,
	mailOutline,
	refreshOutline,
	saveOutline,
	trashOutline,
} from 'ionicons/icons';
import { BehaviorSubject } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateCodeEditorComponent } from './email-template-code-editor.component';
import {
	mergeTemplateFieldDefinitions,
	renderEmailTemplatePreview,
} from './email-template-editor.helpers';

@Component({
	selector: 'admin-email-template-editor',
	templateUrl: './email-template-editor.page.html',
	styleUrls: ['./email-template-editor.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AsyncPipe,
		HeaderComponent,
		ReactiveFormsModule,
		EmailTemplateCodeEditorComponent,
		IonBadge,
		IonButton,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonContent,
		IonIcon,
		IonInput,
		IonItem,
		IonLabel,
		IonList,
		IonNote,
		IonSelect,
		IonSelectOption,
		IonTextarea,
	],
})
export class EmailTemplateEditorPage implements AfterViewInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly emailTemplateService = inject(EmailTemplateService);
	private readonly loadingController = inject(LoadingController);
	private readonly alerts = inject(AlertController);

	@ViewChild('previewFrame')
	private readonly previewFrame?: ElementRef<HTMLIFrameElement>;

	public readonly pageTitle = 'Email Template Editor';
	public readonly subjectPlaceholder =
		"Here's your ticket for {{eventName}}!";
	public readonly firstNameExample = '{{firstName}}';
	public readonly deliveryProfileOptions: readonly {
		label: string;
		value: EmailTemplateDeliveryProfile;
	}[] = [
		{
			label: 'Registration confirmation',
			value: DELIVERY_PROFILES.registrationConfirmation,
		},
		{
			label: 'Event reminder',
			value: DELIVERY_PROFILES.eventReminder,
		},
	];
	public html = '';
	public previewHtml = '';
	public revisions: EmailTemplateRevision[] = [];
	public currentTemplate?: EmailTemplateSummary;
	public selectedRevisionId?: string;
	public readonly isCreateMode$ = new BehaviorSubject<boolean>(true);
	public readonly testEmailForm = new UntypedFormGroup({
		recipientEmail: new UntypedFormControl('', {
			nonNullable: true,
			validators: [Validators.required, Validators.email],
		}),
	});

	public readonly form = new UntypedFormGroup({
		key: new UntypedFormControl('', {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
			],
		}),
		deliveryProfile: new UntypedFormControl(
			DELIVERY_PROFILES.registrationConfirmation,
			{
				nonNullable: true,
				validators: [Validators.required],
			},
		),
		displayName: new UntypedFormControl('', {
			nonNullable: true,
			validators: [Validators.required],
		}),
		description: new UntypedFormControl('', { nonNullable: true }),
		awsTemplateName: new UntypedFormControl('', {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.pattern(/^[A-Za-z0-9_-]{1,64}$/),
			],
		}),
		subjectPart: new UntypedFormControl('', {
			nonNullable: true,
			validators: [Validators.required],
		}),
		notes: new UntypedFormControl('', { nonNullable: true }),
		fieldMappings: new UntypedFormArray([]),
	});

	constructor() {
		addIcons({
			cloudUploadOutline,
			documentTextOutline,
			mailOutline,
			refreshOutline,
			saveOutline,
			trashOutline,
		});
	}

	public async ionViewWillEnter(): Promise<void> {
		await this.loadTemplate();
	}

	public ngAfterViewInit(): void {
		this.syncPreviewFrame();
	}

	public get fieldMappings(): UntypedFormArray {
		return this.form.controls['fieldMappings'] as UntypedFormArray;
	}

	public revisionBadgeColor(revision: EmailTemplateRevision): string {
		return revision.id === this.currentTemplate?.publishedRevisionId
			? 'success'
			: 'medium';
	}

	public availableRuntimeFields(): readonly string[] {
		const deliveryProfile = this.form.controls['deliveryProfile']
			.value as EmailTemplateDeliveryProfile;

		return RUNTIME_FIELDS[deliveryProfile] ?? [];
	}

	public onDeliveryProfileChanged(): void {
		const allowedFields = this.availableRuntimeFields();
		const firstAllowedField = allowedFields[0] ?? 'firstName';
		const normalizedFields = this.fieldDefinitions().map((field) => ({
			...field,
			mapping: this.normalizeFieldMapping(
				field.mapping,
				field.name,
				allowedFields,
				firstAllowedField,
			),
		}));

		this.setFieldMappings(normalizedFields);
		this.refreshPreview();
	}

	public onSubjectChanged(): void {
		this.reconcileFieldMappings();
	}

	public async loadRevision(revision: EmailTemplateRevision): Promise<void> {
		const key = this.form.controls['key'].value;
		if (!key) {
			return;
		}

		await this.presentLoading('Loading revision…');
		try {
			const result = await this.emailTemplateService.getEmailTemplateRevision({
				key,
				revisionId: revision.id,
			});
			this.selectedRevisionId = result.revision.id;
			this.form.controls['subjectPart'].setValue(result.revision.subjectPart);
			this.form.controls['notes'].setValue(result.revision.notes ?? '');
			this.setFieldMappings(result.revision.fieldMappings);
			this.html = result.html;
			this.reconcileFieldMappings();
			this.refreshPreview();
		} catch (error) {
			await this.showError(error, 'Could not load that revision.');
		} finally {
			await this.dismissLoading();
		}
	}

	public onHtmlChange(html: string): void {
		this.html = html;
		this.reconcileFieldMappings();
		this.refreshPreview();
	}

	public refreshPreview(): void {
		this.previewHtml = renderEmailTemplatePreview(this.html, this.fieldDefinitions());
		this.syncPreviewFrame();
	}

	public async sendTestEmail(): Promise<void> {
		const recipientEmail = this.testEmailForm.controls['recipientEmail'].value;
		if (!recipientEmail || !this.testEmailForm.valid || !this.html.trim()) {
			this.testEmailForm.markAllAsTouched();
			await this.showMessage(
				'Validation',
				'Enter a valid recipient email and make sure the template has HTML before sending a test email.',
			);
			return;
		}

		await this.presentLoading('Sending test email…');
		try {
			const payload: SendTestEmailTemplateRequest = {
				recipientEmail,
				deliveryProfile: this.form.controls['deliveryProfile'].value,
				subjectPart: this.form.controls['subjectPart'].value,
				html: this.html,
				fieldMappings: this.fieldDefinitions(),
			};

			const result =
				await this.emailTemplateService.sendTestEmailTemplate(payload);
			await this.showMessage(
				'Test email sent',
				`A rendered draft email was sent to ${result.recipientEmail}.`,
			);
		} catch (error) {
			await this.showError(error, 'Could not send a test email.');
		} finally {
			await this.dismissLoading();
		}
	}

	public async saveRevision(): Promise<void> {
		if (!this.form.valid || !this.html.trim()) {
			this.form.markAllAsTouched();
			await this.showMessage('Validation', 'Complete the required fields and add HTML before saving.');
			return;
		}

		await this.presentLoading('Saving revision…');
		try {
			const payload = this.buildSavePayload();
			const result = await this.emailTemplateService.saveEmailTemplateRevision(payload);
			this.currentTemplate = result.template;
			this.selectedRevisionId = result.revision.id;
			this.form.controls['notes'].setValue('');
			this.revisions = [result.revision, ...this.revisions.filter((revision) => revision.id !== result.revision.id)];
			this.isCreateMode$.next(false);
			await this.showMessage('Saved', `Revision r${result.revision.revisionNumber} saved.`);
			if (!this.route.snapshot.paramMap.get('key')) {
				await this.router.navigate(['/admin/email-templates', result.template.key], {
					replaceUrl: true,
				});
			}
		} catch (error) {
			await this.showError(error, 'Could not save this revision.');
		} finally {
			await this.dismissLoading();
		}
	}

	public async publishTemplate(): Promise<void> {
		const key = this.form.controls['key'].value;
		if (!key) {
			return;
		}

		await this.presentLoading('Publishing to AWS SES…');
		try {
			const result = await this.emailTemplateService.publishEmailTemplate({
				key,
				revisionId: this.selectedRevisionId,
			});
			this.currentTemplate = result.template;
			this.revisions = this.revisions.map((revision) =>
				revision.id === result.revision.id ? result.revision : revision,
			);
			await this.showMessage(
				'Published',
				`${result.template.displayName} is now published to AWS SES as ${result.template.awsTemplateName}.`,
			);
		} catch (error) {
			await this.showError(error, 'Publish failed.');
		} finally {
			await this.dismissLoading();
		}
	}

	public async deleteTemplate(): Promise<void> {
		const key = this.form.controls['key'].value;
		if (!key || this.isCreateMode$.value) {
			return;
		}

		const confirmation = await this.alerts.create({
			header: 'Delete email template?',
			message: `Delete ${key} and all of its saved revisions? This cannot be undone.`,
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{ text: 'Delete', role: 'destructive' },
			],
		});
		await confirmation.present();
		const result = await confirmation.onDidDismiss();
		if (result.role !== 'destructive') {
			return;
		}

		await this.presentLoading('Deleting template…');
		try {
			await this.emailTemplateService.deleteEmailTemplate(key);
			await this.dismissLoading();
			const alert = await this.alerts.create({
				header: 'Deleted',
				message: `${key} was deleted.`,
				buttons: ['OK'],
			});
			await alert.present();
			await alert.onDidDismiss();
			await this.router.navigate(['/admin/email-templates']);
		} catch (error) {
			await this.dismissLoading();
			await this.showError(error, 'Could not delete this template.');
		}
	}

	private async loadTemplate(): Promise<void> {
		const key = this.route.snapshot.paramMap.get('key');
		if (!key) {
			this.isCreateMode$.next(true);
			this.currentTemplate = undefined;
			this.revisions = [];
			this.selectedRevisionId = undefined;
			this.form.controls['key'].enable();
			this.form.reset({
				key: '',
				deliveryProfile: DELIVERY_PROFILES.registrationConfirmation,
				displayName: '',
				description: '',
				awsTemplateName: '',
				subjectPart: '',
				notes: '',
			});
			this.testEmailForm.reset({ recipientEmail: '' });
			this.html = '';
			this.setFieldMappings([]);
			this.refreshPreview();
			return;
		}

		await this.presentLoading('Loading template…');
		try {
			const detail = await this.emailTemplateService.getEmailTemplate(key);
			this.applyTemplateDetail(detail);
			this.isCreateMode$.next(false);
		} catch (error) {
			await this.showError(error, 'Could not load that template.');
		} finally {
			await this.dismissLoading();
		}
	}

	private applyTemplateDetail(detail: EmailTemplateDetail): void {
		this.currentTemplate = detail.template;
		this.revisions = detail.revisions;
		this.selectedRevisionId = detail.template.currentRevisionId;
		this.form.controls['key'].setValue(detail.template.key);
		this.form.controls['key'].disable();
		this.form.controls['deliveryProfile'].setValue(
			detail.template.deliveryProfile,
		);
		this.form.controls['displayName'].setValue(detail.template.displayName);
		this.form.controls['description'].setValue(detail.template.description ?? '');
		this.form.controls['awsTemplateName'].setValue(detail.template.awsTemplateName);
		this.form.controls['subjectPart'].setValue(detail.template.subjectPart);
		this.form.controls['notes'].setValue('');
		this.testEmailForm.reset({ recipientEmail: '' });
		this.html = detail.currentHtml ?? '';
		this.setFieldMappings(detail.template.fieldMappings);
		this.reconcileFieldMappings();
		this.refreshPreview();
	}

	private buildSavePayload(): SaveEmailTemplateRevisionRequest {
		return {
			key: this.form.controls['key'].value,
			deliveryProfile: this.form.controls['deliveryProfile'].value,
			displayName: this.form.controls['displayName'].value,
			description: this.form.controls['description'].value,
			awsTemplateName: this.form.controls['awsTemplateName'].value,
			subjectPart: this.form.controls['subjectPart'].value,
			html: this.html,
			fieldMappings: this.fieldDefinitions(),
			notes: this.form.controls['notes'].value,
		};
	}

	private fieldDefinitions(): EmailTemplateFieldDefinition[] {
		return this.fieldMappings.getRawValue() as EmailTemplateFieldDefinition[];
	}

	private normalizeFieldMapping(
		mapping: string,
		fieldName: string,
		allowedFields: readonly string[],
		fallbackField: string,
	): string {
		if (allowedFields.includes(mapping)) {
			return mapping;
		}

		if (allowedFields.includes(fieldName)) {
			return fieldName;
		}

		return fallbackField;
	}

	private reconcileFieldMappings(): void {
		const merged = mergeTemplateFieldDefinitions(
			this.html,
			this.form.controls['subjectPart'].value,
			this.fieldDefinitions(),
		);
		this.setFieldMappings(merged);
	}

	private setFieldMappings(fields: EmailTemplateFieldDefinition[]): void {
		while (this.fieldMappings.length > 0) {
			this.fieldMappings.removeAt(0);
		}

		for (const field of fields) {
			this.fieldMappings.push(
				new UntypedFormGroup({
					name: new UntypedFormControl(field.name, {
						nonNullable: true,
					}),
					mapping: new UntypedFormControl(field.mapping, {
						nonNullable: true,
					}),
					sampleValue: new UntypedFormControl(field.sampleValue, {
						nonNullable: true,
					}),
					description: new UntypedFormControl(field.description ?? '', {
						nonNullable: true,
					}),
				}),
			);
		}
	}

	private syncPreviewFrame(): void {
		if (!this.previewFrame) {
			return;
		}

		this.previewFrame.nativeElement.srcdoc = this.previewHtml;
	}

	private async presentLoading(message: string): Promise<HTMLIonLoadingElement> {
		const loading = await this.loadingController.create({
			message,
			translucent: true,
			backdropDismiss: false,
		});
		await loading.present();
		return loading;
	}

	private async dismissLoading(): Promise<void> {
		if (await this.loadingController.getTop()) {
			await this.loadingController.dismiss();
		}
	}

	private async showMessage(header: string, message: string): Promise<void> {
		const alert = await this.alerts.create({
			header,
			message,
			buttons: ['OK'],
		});
		await alert.present();
	}

	private async showError(error: unknown, fallback: string): Promise<void> {
		const err = error as { details?: string; message?: string };
		await this.showMessage('Something went wrong', err.details ?? err.message ?? fallback);
	}
}
