import {
	Component,
	ChangeDetectionStrategy,
	OnInit,
	ChangeDetectorRef,
	inject,
	Input,
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
	IonList,
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
import { BehaviorSubject } from 'rxjs';
import {
	yyyymmddToLocalDate,
	getAgeFromDate,
} from '@santashop/core/admin/firestore';
import {
	ChildValidationService,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from '../../services/child-validation.service';
import { AsyncPipe } from '@angular/common';

@Component({
	selector: 'admin-add-edit-child-modal',
	templateUrl: './add-edit-child-modal.component.html',
	styleUrls: ['./add-edit-child-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		AsyncPipe,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonList,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonInput,
		IonRadioGroup,
		IonRadio,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonList,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonInput,
		IonRadioGroup,
		IonRadio,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonList,
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
	protected readonly childValidationService = inject(ChildValidationService);

	@Input() public child?: Child;

	public form: UntypedFormGroup = this.newForm();

	public readonly minBirthDate = this.dateForInput(MIN_BIRTHDATE());
	public readonly maxBirthDate = this.dateForInput(MAX_BIRTHDATE());

	private readonly isInfant = new BehaviorSubject<boolean>(false);
	public readonly isInfant$ = this.isInfant.asObservable();

	public ngOnInit(): void {
		this.form = this.newForm(this.child);
		this.changeDetector.markForCheck();

		const child = this.child;
		if (child?.dateOfBirth) {
			const dob = this.dateForInput(child.dateOfBirth);
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
					Validators.maxLength(20),
				]),
			),
			dateOfBirth: new UntypedFormControl(
				child?.dateOfBirth
					? this.dateForInput(child.dateOfBirth)
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
		this.isInfant.next(true);

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
		const ageInYears = getAgeFromDate(dateOfBirth, MAX_BIRTHDATE());
		let ageGroup: AgeGroup | undefined;
		const wasInfant = this.isInfant.getValue();

		if (ageInYears >= 0 && ageInYears < 3) {
			this.setInfant(true);
			return;
		} else if (ageInYears >= 3 && ageInYears < 6) {
			ageGroup = AgeGroup.age35;
		} else if (ageInYears >= 6 && ageInYears < 9) {
			ageGroup = AgeGroup.age68;
		} else if (ageInYears >= 9 && ageInYears < 13) {
			ageGroup = AgeGroup.age911;
		} else {
			await this.childTooOldAlert();
			this.form.controls['dateOfBirth'].setValue(undefined);
			return;
		}

		this.form.controls['ageGroup'].setValue(ageGroup);
		this.isInfant.next(false);
		if (wasInfant) this.form.controls['toyType'].setValue(undefined);
	}

	private async childTooOldAlert(): Promise<void> {
		const alert = await this.alertController.create({
			header: 'This child is too old',
			message: 'Children must be under 13 years old.',
			buttons: [
				{
					text: 'Ok',
				},
			],
		});

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

	private dateForInput(date: Date): string {
		const isUtcMidnight =
			date.getUTCHours() === 0 &&
			date.getUTCMinutes() === 0 &&
			date.getUTCSeconds() === 0 &&
			date.getUTCMilliseconds() === 0;
		const year = isUtcMidnight ? date.getUTCFullYear() : date.getFullYear();
		const month = isUtcMidnight ? date.getUTCMonth() : date.getMonth();
		const day = isUtcMidnight ? date.getUTCDate() : date.getDate();

		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
