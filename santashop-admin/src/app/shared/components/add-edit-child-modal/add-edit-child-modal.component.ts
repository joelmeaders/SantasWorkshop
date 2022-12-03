import {
	Component,
	ChangeDetectionStrategy,
	Input,
	OnInit,
} from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import { AlertController, ModalController } from '@ionic/angular';
import { AgeGroup, Child, ToyType } from '@models/*';
import { BehaviorSubject } from 'rxjs';
import { yyyymmddToLocalDate, getAgeFromDate } from '@core/*';
import {
	ChildValidationService,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from '../../services/child-validation.service';

@Component({
	selector: 'admin-add-edit-child-modal',
	templateUrl: './add-edit-child-modal.component.html',
	styleUrls: ['./add-edit-child-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddEditChildModalComponent implements OnInit {
	@Input()
	public child?: Child;

	public form?: UntypedFormGroup;

	public readonly minBirthDate = MIN_BIRTHDATE().toISOString();
	public readonly maxBirthDate = MAX_BIRTHDATE().toISOString();

	private readonly isInfant = new BehaviorSubject<boolean>(false);
	public readonly isInfant$ = this.isInfant.asObservable();

	constructor(
		private readonly modalController: ModalController,
		private readonly alertController: AlertController,
		protected readonly childValidationService: ChildValidationService
	) {}

	public ngOnInit(): void {
		this.form = this.newForm(this.child);

		if (this.child?.dateOfBirth) {
			const dob: string = this.child.dateOfBirth
				.toISOString()
				.substring(0, 10);
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
				])
			),
			lastName: new UntypedFormControl(
				child?.lastName,
				Validators.compose([
					Validators.required,
					Validators.minLength(2),
					Validators.maxLength(20),
				])
			),
			dateOfBirth: new UntypedFormControl(
				child?.dateOfBirth
					? child.dateOfBirth.toISOString().substring(0, 10)
					: undefined,
				Validators.compose([
					Validators.required,
					Validators.pattern(
						/20\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])/
					),
				])
			),
			ageGroup: new UntypedFormControl(undefined, Validators.required),
			toyType: new UntypedFormControl(
				child?.toyType,
				Validators.required
			),
		});
	}

	public setInfant(value: boolean): void {
		if (!this.form) return;
		this.isInfant.next(true);

		const toyTypeControl = this.form.controls.toyType;
		const ageGroupControl = this.form.controls.ageGroup;

		if (value) {
			toyTypeControl.setValue(ToyType.infant);
			ageGroupControl.setValue(AgeGroup.age02);
		}
	}

	public async birthdaySelected(event?: any): Promise<void> {
		if (!this.form) return;

		const yyyymmdd = event?.detail?.value;

		if (!yyyymmdd) return;
		if (yyyymmdd[0]?.toString() !== '2') return;

		const dateOfBirth = yyyymmddToLocalDate(yyyymmdd);
		const ageInYears = getAgeFromDate(dateOfBirth, MAX_BIRTHDATE());
		let ageGroup: AgeGroup | undefined;

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
			this.form.controls.dateOfBirth.setValue(undefined);
			return;
		}

		this.form.controls.ageGroup.setValue(ageGroup);
		this.isInfant.next(false);
	}

	private async childTooOldAlert(): Promise<any> {
		const alert = await this.alertController.create({
			header: 'This child is too old',
			message: 'Children can only be ages 0-11',
			buttons: [
				{
					text: 'Ok',
				},
			],
		});

		await alert.present();
		return alert.onDidDismiss();
	}

	public async saveChild(): Promise<void> {
		const child: Child = this.form?.value;
		child.dateOfBirth = new Date(this.form?.controls.dateOfBirth.value);
		await this.dismiss(child);
	}

	public async dismiss(child?: Child): Promise<void> {
		let role = '';

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
