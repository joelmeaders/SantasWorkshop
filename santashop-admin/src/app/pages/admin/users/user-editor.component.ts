import {
	ChangeDetectionStrategy,
	Component,
	Input,
	OnInit,
	inject,
} from '@angular/core';
import {
	ReactiveFormsModule,
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import {
	IonButton,
	IonContent,
	IonHeader,
	IonInput,
	IonItem,
	IonList,
	IonNote,
	IonSelect,
	IonSelectOption,
	IonTitle,
	IonToggle,
	IonToolbar,
	ModalController,
} from '@ionic/angular/standalone';
import type {
	CreateStaffUser,
	StaffAccount,
	StaffRole,
	UpdateStaffUser,
} from '@santashop/models';

interface RoleOption {
	readonly value: StaffRole;
	readonly label: string;
}

@Component({
	selector: 'admin-user-editor',
	templateUrl: './user-editor.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonList,
		IonItem,
		IonInput,
		IonSelect,
		IonSelectOption,
		IonToggle,
		IonNote,
	],
})
export class UserEditorComponent implements OnInit {
	private readonly modalController = inject(ModalController);

	@Input() public account?: StaffAccount;
	@Input() public isOwner = false;

	public get roleOptions(): readonly RoleOption[] {
		return [
			...(this.isOwner
				? [{ value: 'admin', label: 'Administrator' } as RoleOption]
				: []),
			{ value: 'checkin', label: 'Check-In' },
		];
	}

	public form!: UntypedFormGroup;
	public isEdit = false;

	public ngOnInit(): void {
		const account = this.account;
		this.isEdit = !!account;
		const initialRoles = this.normalizeRoles(account?.roles ?? []);

		this.form = new UntypedFormGroup({
			emailAddress: new UntypedFormControl(
				{ value: account?.emailAddress ?? '', disabled: this.isEdit },
				[Validators.required, Validators.email],
			),
			displayName: new UntypedFormControl(account?.displayName ?? '', [
				Validators.required,
				Validators.minLength(2),
			]),
			roles: new UntypedFormControl(initialRoles, [
				Validators.required,
				Validators.minLength(1),
			]),
			password: new UntypedFormControl(
				'',
				this.isEdit ? [] : [Validators.required, Validators.minLength(8)],
			),
			disabled: new UntypedFormControl(account?.disabled ?? false),
		});
	}

	public async save(): Promise<void> {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const value = this.form.getRawValue();
		const roles = this.normalizeRoles(value.roles);

		if (this.isEdit) {
			const account = this.account;
			const data: UpdateStaffUser = {
				uid: account?.uid ?? '',
				displayName: value.displayName,
				roles,
				disabled: value.disabled,
			};

			if (value.password) {
				data.newPassword = value.password;
			}

			await this.modalController.dismiss(data, 'update');
			return;
		}

		const data: CreateStaffUser = {
			emailAddress: value.emailAddress,
			displayName: value.displayName,
			password: value.password,
			roles,
		};

		await this.modalController.dismiss(data, 'create');
	}

	private normalizeRoles(roles: StaffRole[] | undefined): StaffRole[] {
		const normalized = new Set<StaffRole>(roles ?? []);
		if (normalized.has('admin')) {
			normalized.add('checkin');
		}

		return Array.from(normalized);
	}

	public async dismiss(): Promise<void> {
		await this.modalController.dismiss(undefined, 'cancelled');
	}
}
