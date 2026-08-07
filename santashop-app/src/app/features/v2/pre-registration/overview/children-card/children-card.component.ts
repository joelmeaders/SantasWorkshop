import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Child, AgeGroup, ToyType } from '@santashop/models';
import { MAX_BIRTHDATE, MIN_BIRTHDATE, getAgeFromDate, yyyymmddToLocalDate } from '@santashop/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { manOutline, womanOutline, happyOutline, alertCircle, trashOutline, addCircle } from 'ionicons/icons';
import {
	IonBadge,
	IonButton,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonIcon,
	IonInput,
	IonItem,
	IonLabel,
	IonList,
	IonListHeader,
	IonModal,
	IonNote,
	IonRadio,
	IonRadioGroup,
	IonButtons,
	IonContent,
	IonHeader,
	IonTitle,
	IonToolbar,
} from '@ionic/angular';

interface ChildFormValue {
	id: FormControl<number>;
	firstName: FormControl<string>;
	lastName: FormControl<string>;
	dateOfBirth: FormControl<string>;
	ageGroup: FormControl<AgeGroup | null>;
	toyType: FormControl<ToyType | null>;
	programYearAdded: FormControl<number>;
	enabled: FormControl<boolean>;
}

@Component({
	selector: 'app-children-card',
	templateUrl: './children-card.component.html',
	styleUrls: ['./children-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		DatePipe,
		TranslateModule,
		IonBadge,
		IonButton,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonIcon,
		IonInput,
		IonItem,
		IonLabel,
		IonList,
		IonListHeader,
		IonModal,
		IonNote,
		IonRadio,
		IonRadioGroup,
		IonButtons,
		IonContent,
		IonHeader,
		IonTitle,
		IonToolbar,
	],
})
export class ChildrenCardComponent {
	public readonly children = input<Child[]>([]);
	public readonly childCount = input(0);
	public readonly programYear = input(0);
	public readonly busy = input(false);
	public readonly collapsed = input(false);
	public readonly saveRequested = output<ChildSaveRequest>();
	public readonly deleteRequested = output<Child>();
	public readonly editorOpen = signal(false);
	public readonly editingChildId = signal<number | undefined>(undefined);
	public readonly editingChild = signal<Child | undefined>(undefined);
	public readonly isInfant = signal(false);
	public readonly hasSelectedAge = signal(false);
	public readonly showToyTypeControls = computed(
		() => this.hasSelectedAge() && !this.isInfant(),
	);
	public readonly form = this.createForm();
	private readonly firstNameInput = viewChild<IonInput>('firstNameInput');
	public readonly minBirthDate = MIN_BIRTHDATE().toISOString().slice(0, 10);
	public readonly maxBirthDate = MAX_BIRTHDATE().toISOString().slice(0, 10);

	constructor() {
		addIcons({ manOutline, womanOutline, happyOutline, alertCircle, trashOutline, addCircle });
	}

	public openNewChild(): void {
		this.editingChildId.set(undefined);
		this.editingChild.set(undefined);
		this.isInfant.set(false);
		this.hasSelectedAge.set(false);
		this.form.reset({
			id: Math.floor(Math.random() * 100000),
			firstName: '',
			lastName: '',
			dateOfBirth: '',
			ageGroup: null,
			toyType: null,
			programYearAdded: this.programYear(),
			enabled: true,
		});
		this.editorOpen.set(true);
		this.focusFirstName();
	}

	public editChild(child: Child): void {
		this.editingChildId.set(child.id);
		this.editingChild.set(child);
		this.form.reset({
			id: child.id ?? Math.floor(Math.random() * 100000),
			firstName: child.firstName,
			lastName: child.lastName,
			dateOfBirth: this.dateForInput(child.dateOfBirth),
			ageGroup: child.ageGroup ?? null,
			toyType: child.toyType ?? null,
			programYearAdded: child.programYearAdded ?? this.programYear(),
			enabled: child.enabled,
		});
		this.isInfant.set(child.toyType === ToyType.infant);
		this.hasSelectedAge.set(true);
		this.editorOpen.set(true);
		this.focusFirstName();
	}

	public birthdaySelected(value: string | null | undefined): void {
		if (!value || value[0] !== '2') {
			this.hasSelectedAge.set(false);
			this.isInfant.set(false);
			this.form.controls.ageGroup.setValue(null);
			this.form.controls.toyType.setValue(null);
			return;
		}
		const dateOfBirth = yyyymmddToLocalDate(value);
		const age = getAgeFromDate(dateOfBirth, MAX_BIRTHDATE());
		this.hasSelectedAge.set(age >= 0 && age < 13);
		if (age >= 0 && age < 3) {
			this.isInfant.set(true);
			this.form.controls.ageGroup.setValue(AgeGroup.age02);
			this.form.controls.toyType.setValue(ToyType.infant);
			return;
		}
		this.isInfant.set(false);
		if (this.form.controls.toyType.value === ToyType.infant) {
			this.form.controls.toyType.setValue(null);
		}
		if (age >= 3 && age < 6) this.form.controls.ageGroup.setValue(AgeGroup.age35);
		else if (age >= 6 && age < 9) this.form.controls.ageGroup.setValue(AgeGroup.age68);
		else if (age >= 9 && age < 13) this.form.controls.ageGroup.setValue(AgeGroup.age911);
		else {
			this.hasSelectedAge.set(false);
			this.form.controls.ageGroup.setValue(null);
			this.form.controls.toyType.setValue(null);
		}
	}

	public saveChild(): void {
		if (this.form.invalid || this.busy()) {
			this.form.markAllAsTouched();
			return;
		}
		const value = this.form.getRawValue();
		this.saveRequested.emit({
			isNew: this.editingChildId() === undefined,
			child: {
				id: value.id,
				firstName: value.firstName.trim(),
				lastName: value.lastName.trim(),
				dateOfBirth: yyyymmddToLocalDate(value.dateOfBirth),
				ageGroup: value.ageGroup ?? undefined,
				toyType: value.toyType ?? undefined,
				programYearAdded: value.programYearAdded,
				enabled: value.enabled,
			},
		});
	}

	public deleteCurrentChild(): void {
		const child = this.editingChild();
		if (child && !this.busy()) this.deleteRequested.emit(child);
	}

	public collapseEditor(): void {
		this.editorOpen.set(false);
	}

	public modalPresented(): void {
		this.focusFirstName();
	}

	private createForm(): FormGroup<ChildFormValue> {
		return new FormGroup<ChildFormValue>({
			id: new FormControl(Math.floor(Math.random() * 100000), { nonNullable: true }),
			firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(25)] }),
			lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(25)] }),
			dateOfBirth: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
			ageGroup: new FormControl<AgeGroup | null>(null, Validators.required),
			toyType: new FormControl<ToyType | null>(null, Validators.required),
			programYearAdded: new FormControl(0, { nonNullable: true }),
			enabled: new FormControl(true, { nonNullable: true }),
		});
	}

	private dateForInput(value: Date): string {
		const date = new Date(value);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	private focusFirstName(): void {
		window.setTimeout(() => void this.firstNameInput()?.setFocus());
	}
}

export interface ChildSaveRequest {
	child: Child;
	isNew: boolean;
}
