import { createAdminAlert } from '../../preferences/admin-overlays';
import { AdminTextPipe } from '../../preferences/admin-text.pipe';
import {
	Component,
	ChangeDetectionStrategy,
	OnInit,
	ChangeDetectorRef,
	inject,
	Input,
	signal,
} from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import {
	AlertController,
	ModalController,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonButton,
	IonContent,
	IonListHeader,
	IonNote,
	IonItemDivider,
	IonLabel,
	IonItem,
	IonInput,
	IonRadioGroup,
	IonRadio,
} from '@ionic/angular/standalone';
import type { Child } from '@santashop/models';
import { AgeGroup, ToyType } from '@santashop/models';
import {
	yyyymmddToLocalDate,
	getAgeFromDate,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
	PROGRAM_YEAR,
	dateToCalendarString,
} from '@santashop/core/admin/firestore';

@Component({
	selector: 'admin-add-edit-child-modal',
	templateUrl: './add-edit-child-modal.component.html',
	styleUrls: ['./add-edit-child-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		ReactiveFormsModule,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonInput,
		IonRadioGroup,
		IonRadio,
	],
})
export class AddEditChildModalComponent implements OnInit {
	private readonly modalController = inject(ModalController);
	private readonly alertController = inject(AlertController);
	private readonly changeDetector = inject(ChangeDetectorRef);
	private readonly programYear =
		inject(PROGRAM_YEAR, { optional: true }) ?? new Date().getFullYear();

	@Input() public child?: Child;

	public form: UntypedFormGroup = this.newForm();

	public readonly minBirthDate = dateToCalendarString(
		MIN_BIRTHDATE(this.programYear),
	);
	public readonly maxBirthDate = dateToCalendarString(
		MAX_BIRTHDATE(this.programYear),
	);

	public readonly isInfant = signal(false);

	public ngOnInit(): void {
		this.form = this.newForm(this.child);
		this.changeDetector.markForCheck();

		const child = this.child;
		if (child?.dateOfBirth) {
			const dob = dateToCalendarString(child.dateOfBirth);
			this.birthdaySelected({ detail: { value: dob } });
		}
	}

	private newForm(child?: Child): UntypedFormGroup {
		return new UntypedFormGroup({
			id: new UntypedFormControl(child?.id),
			firstName: new UntypedFormControl(
				child?.firstName,
				Validators.compose([
					Validators.required,
					Validators.minLength(2),
					Validators.maxLength(20),
				]),
			),
			lastName: new UntypedFormControl(
				child?.lastName,
				Validators.compose([
					Validators.required,
					Validators.minLength(2),
					Validators.maxLength(25),
				]),
			),
			dateOfBirth: new UntypedFormControl(
				child?.dateOfBirth
					? dateToCalendarString(child.dateOfBirth)
					: undefined,
				Validators.compose([
					Validators.required,
					Validators.pattern(
						/20\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])/,
					),
				]),
			),
			ageGroup: new UntypedFormControl(undefined, Validators.required),
			toyType: new UntypedFormControl(
				child?.toyType,
				Validators.required,
			),
		});
	}

	public setInfant(value: boolean): void {
		if (!this.form) return;
		this.isInfant.set(value);

		const toyTypeControl = this.form.controls['toyType'];
		const ageGroupControl = this.form.controls['ageGroup'];

		if (value) {
			toyTypeControl.setValue(ToyType.infant);
			ageGroupControl.setValue(AgeGroup.age02);
		}
	}

	public async birthdaySelected(event?: {
		detail?: { value?: string | null };
	}): Promise<void> {
		if (!this.form) return;

		const yyyymmdd = event?.detail?.value;

		if (!yyyymmdd) return;
		if (yyyymmdd[0]?.toString() !== '2') return;

		const dateOfBirth = yyyymmddToLocalDate(yyyymmdd);
		const ageInYears = getAgeFromDate(
			dateOfBirth,
			MAX_BIRTHDATE(this.programYear),
		);
		let ageGroup: AgeGroup | undefined;
		const wasInfant = this.isInfant();

		if (ageInYears >= 0 && ageInYears < 3) {
			this.setInfant(true);
			return;
		} else if (ageInYears >= 3 && ageInYears < 6) {
			ageGroup = AgeGroup.age35;
		} else if (ageInYears >= 6 && ageInYears < 9) {
			ageGroup = AgeGroup.age68;
		} else if (ageInYears >= 9 && ageInYears < 12) {
			ageGroup = AgeGroup.age911;
		} else {
			await this.childTooOldAlert();
			this.form.controls['dateOfBirth'].setValue(undefined);
			return;
		}

		this.form.controls['ageGroup'].setValue(ageGroup);
		this.isInfant.set(false);
		if (wasInfant) this.form.controls['toyType'].setValue(undefined);
	}

	private async childTooOldAlert(): Promise<void> {
		const alert = await createAdminAlert(this.alertController, () => ({
			header: 'This child is too old',
			message: 'Children must be 11 years old or younger.',
			buttons: [
				{
					text: 'Ok',
				},
			],
		}));

		await alert.present();
		await alert.onDidDismiss();
	}

	public async saveChild(): Promise<void> {
		if (this.form.invalid) return;
		const child: Child = this.form?.value;
		child.dateOfBirth = yyyymmddToLocalDate(
			this.form.controls['dateOfBirth'].value,
		);
		await this.dismiss(child);
	}

	public async dismiss(child?: Child): Promise<void> {
		let role: string;

		if (!child) {
			role = 'cancelled';
		} else if (child?.id) {
			role = 'edit';
		} else {
			child.id = Math.floor(Math.random() * 100000);
			role = 'add';
		}

		await this.modalController.dismiss(child, role);
	}
}
