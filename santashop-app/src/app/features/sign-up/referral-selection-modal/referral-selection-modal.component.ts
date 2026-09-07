import {
	ChangeDetectionStrategy,
	Component,
	Input,
	computed,
	inject,
	signal,
} from '@angular/core';
import {
	AbstractControl,
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	ValidationErrors,
	ValidatorFn,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
	IonButton,
	IonButtons,
	IonContent,
	IonHeader,
	IonInput,
	IonItem,
	IonLabel,
	IonList,
	IonNote,
	IonSearchbar,
	IonText,
	IonTitle,
	IonToolbar,
	ModalController,
} from '@ionic/angular/standalone';
import referringAgencies from '../../../../assets/referring-agencies.json';

interface ReferralGroups {
	common: string[];
	alphabetical: string[];
}

const trimmedLengthValidator =
	(minimum: number, maximum: number): ValidatorFn =>
	(control: AbstractControl): ValidationErrors | null => {
		const value =
			typeof control.value === 'string' ? control.value.trim() : '';

		if (!value) return { required: true };
		if (value.length < minimum) {
			return {
				minlength: {
					requiredLength: minimum,
					actualLength: value.length,
				},
			};
		}
		if (value.length > maximum) {
			return {
				maxlength: {
					requiredLength: maximum,
					actualLength: value.length,
				},
			};
		}

		return null;
	};

@Component({
	selector: 'app-referral-selection-modal',
	templateUrl: './referral-selection-modal.component.html',
	styleUrls: ['./referral-selection-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		TranslateModule,
		IonButton,
		IonButtons,
		IonContent,
		IonHeader,
		IonInput,
		IonItem,
		IonLabel,
		IonList,
		IonNote,
		IonSearchbar,
		IonText,
		IonTitle,
		IonToolbar,
	],
})
export class ReferralSelectionModalComponent {
	private readonly modalController = inject(ModalController);

	public readonly allReferrals: string[] = referringAgencies.agencies;
	private readonly commonReferrals = this.allReferrals.slice(
		0,
		this.allReferrals.indexOf('----------'),
	);
	private readonly alphabeticalReferrals = this.allReferrals.filter(
		(referral) =>
			referral !== '----------' && !this.commonReferrals.includes(referral),
	);

	private readonly searchText = signal<string | undefined>(undefined);

	public readonly referralGroups = computed<ReferralGroups>(() => {
		const search = this.searchText();
		return {
			common: this.filterReferrals(this.commonReferrals, search),
			alphabetical: this.filterReferrals(this.alphabeticalReferrals, search),
		};
	});

	public readonly selectedReferral = signal<string | undefined>(undefined);

	@Input()
	public set currentValue(value: string | undefined) {
		this.selectedReferral.set(value
			? value.startsWith('Other:')
				? 'Other'
				: value
			: undefined);

		if (this.selectedReferral() === 'Other') {
			this.otherForm.controls.other.setValue(
				value?.slice('Other:'.length) ?? '',
			);
		} else {
			this.otherForm.controls.other.setValue('');
		}
	}

	public readonly otherForm = new FormGroup({
		other: new FormControl('', {
			nonNullable: true,
			validators: [trimmedLengthValidator(3, 20)],
		}),
	});

	public filter(event: CustomEvent<{ value?: string | null }>): void {
		const input = event.detail?.value?.trim();
		this.searchText.set(input ? input.toUpperCase() : undefined);
	}

	public setChoice(choice?: string): void {
		const previousChoice = this.selectedReferral();
		this.selectedReferral.set(choice);
		this.searchText.set(undefined);

		if (choice !== 'Other' || previousChoice !== 'Other') {
			this.otherForm.controls.other.setValue('');
		}
	}

	public async cancel(): Promise<void> {
		await this.modalController.dismiss(undefined, 'cancel');
	}

	public async save(): Promise<void> {
		const choice = this.selectedReferral();
		if (!choice) return;

		if (choice === 'Other') {
			const other = this.otherForm.controls.other.value.trim();
			this.otherForm.controls.other.setValue(other);
			if (this.otherForm.invalid) {
				this.otherForm.markAllAsTouched();
				return;
			}

			await this.modalController.dismiss(`Other:${other}`, 'confirm');
			return;
		}

		await this.modalController.dismiss(choice, 'confirm');
	}

	public isOtherChoice(): boolean {
		return this.selectedReferral() === 'Other';
	}

	private filterReferrals(referrals: string[], search: string | undefined): string[] {
		return search
			? referrals.filter((referral) => referral.toUpperCase().includes(search))
			: referrals;
	}
}
