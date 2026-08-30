import { KeyValuePipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	inject,
	signal,
} from '@angular/core';
import {
	NonNullableFormBuilder,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { AuthService, PROGRAM_YEAR } from '@santashop/core';
import {
	OwnerOperation,
	OwnerOperationType,
	PreviewOwnerOperationResponse,
} from '@santashop/models';
import {
	IonButton,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonContent,
	IonInput,
	IonItem,
	IonNote,
	IonSelect,
	IonSelectOption,
	IonSpinner,
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { OwnerOperationsService } from './owner-operations.service';

interface OperationOption {
	value: OwnerOperationType;
	label: string;
	description: string;
	needsYear: boolean;
}

@Component({
	selector: 'admin-owner-operations',
	templateUrl: './owner-operations.page.html',
	styleUrls: ['./owner-operations.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		KeyValuePipe,
		ReactiveFormsModule,
		HeaderComponent,
		IonButton,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonContent,
		IonInput,
		IonItem,
		IonNote,
		IonSelect,
		IonSelectOption,
		IonSpinner,
	],
})
export class OwnerOperationsPage {
	private readonly service = inject(OwnerOperationsService);
	private readonly authService = inject(AuthService);
	private readonly formBuilder = inject(NonNullableFormBuilder);
	private readonly programYear = inject(PROGRAM_YEAR);
	private readonly destroyRef = inject(DestroyRef);
	private pollTimer?: ReturnType<typeof setTimeout>;

	public readonly options: readonly OperationOption[] = [
		{
			value: 'queue-reminder-emails',
			label: 'Queue reminder emails',
			description:
				'Preview eligible registrations and queue event reminders.',
			needsYear: true,
		},
		{
			value: 'export-marketing-emails',
			label: 'Export marketing emails',
			description: 'Create a private CSV of newsletter subscribers.',
			needsYear: false,
		},
		{
			value: 'export-registered-emails',
			label: 'Export registered emails',
			description:
				'Create a private CSV of submitted registrations for a year.',
			needsYear: true,
		},
		{
			value: 'repair-checkin-flags',
			label: 'Repair check-in flags',
			description:
				'Mark registrations that already have a matching check-in.',
			needsYear: false,
		},
		{
			value: 'rebuild-checkin-stats',
			label: 'Rebuild check-in statistics',
			description:
				'Recompute one year of check-in statistics without double counting.',
			needsYear: true,
		},
		{
			value: 'yearly-reset',
			label: 'Run yearly reset',
			description:
				'Require a marketing export, back up Firestore, then remove customer accounts, seasonal data, and old schedules.',
			needsYear: true,
		},
	];

	public readonly form = this.formBuilder.group({
		operation: this.formBuilder.control<OwnerOperationType>(
			'queue-reminder-emails',
			Validators.required,
		),
		programYear: this.formBuilder.control(this.programYear, [
			Validators.required,
			Validators.min(2000),
		]),
		password: this.formBuilder.control('', Validators.required),
		confirmationPhrase: this.formBuilder.control('', Validators.required),
	});

	public readonly preview = signal<
		PreviewOwnerOperationResponse | undefined
	>(undefined);
	public readonly operation = signal<OwnerOperation | undefined>(undefined);
	public readonly busy = signal(false);
	public readonly statusMessage = signal('');
	public readonly errorMessage = signal('');

	constructor() {
		this.destroyRef.onDestroy(() => {
			if (this.pollTimer) clearTimeout(this.pollTimer);
		});
	}

	public selectedOption(): OperationOption {
		return (
			this.options.find(
				(option) => option.value === this.form.controls.operation.value,
			) ?? this.options[0]
		);
	}

	public onOperationChange(): void {
		this.preview.set(undefined);
		this.operation.set(undefined);
		this.errorMessage.set('');
		this.statusMessage.set('');
		const selected = this.selectedOption();
		if (selected.value === 'yearly-reset') {
			this.form.controls.programYear.setValue(
				new Date().getFullYear() - 1,
			);
		} else {
			this.form.controls.programYear.setValue(this.programYear);
		}
	}

	public async createPreview(): Promise<void> {
		this.busy.set(true);
		this.errorMessage.set('');
		this.statusMessage.set('Calculating the operation preview…');
		try {
			const selected = this.selectedOption();
			const preview = await this.service.preview({
				operation: selected.value,
				...(selected.needsYear
					? { programYear: this.form.controls.programYear.value }
					: {}),
			});
			this.preview.set(preview);
			this.form.controls.confirmationPhrase.setValue('');
			this.statusMessage.set(
				'Preview ready. Reauthenticate and type the exact confirmation phrase.',
			);
		} catch (error) {
			this.showError(error);
		} finally {
			this.busy.set(false);
		}
	}

	public async start(): Promise<void> {
		const preview = this.preview();
		if (!preview || this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.busy.set(true);
		this.errorMessage.set('');
		this.statusMessage.set('Reauthenticating and starting the operation…');
		try {
			await this.authService.reauthenticate(
				this.form.controls.password.value,
			);
			const started = await this.service.start({
				previewId: preview.previewId,
				confirmationPhrase:
					this.form.controls.confirmationPhrase.value,
			});
			this.form.controls.password.setValue('');
			this.statusMessage.set('Operation queued.');
			await this.poll(started.operationId);
		} catch (error) {
			this.showError(error);
			this.busy.set(false);
		}
	}

	public async downloadExport(): Promise<void> {
		const operation = this.operation();
		if (!operation?.result?.['exportAvailable']) return;
		try {
			const result = await this.service.getExportUrl(operation.id);
			window.open(result.url, '_blank', 'noopener,noreferrer');
		} catch (error) {
			this.showError(error);
		}
	}

	private async poll(operationId: string): Promise<void> {
		const current = await this.service.get(operationId);
		this.operation.set(current);
		this.statusMessage.set(
			`${current.operation}: ${current.stage ?? current.status}`,
		);
		if (current.status === 'succeeded' || current.status === 'failed') {
			this.busy.set(false);
			if (current.status === 'failed') {
				this.errorMessage.set(
					current.errorMessage ?? 'The operation failed.',
				);
			}
			return;
		}
		this.pollTimer = setTimeout(() => {
			void this.poll(operationId).catch((error) => {
				this.showError(error);
				this.busy.set(false);
			});
		}, 2000);
	}

	private showError(error: unknown): void {
		const value = error as { details?: string; message?: string };
		this.errorMessage.set(
			value.details ?? value.message ?? 'An unexpected error occurred.',
		);
		this.statusMessage.set('');
	}
}
