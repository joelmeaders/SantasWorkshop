import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { Child, DateTimeSlot } from '@santashop/models';
import { NiceFormErrorPipe, TimeSlotPipe } from '@santashop/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonInput, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, manOutline, womanOutline, happyOutline } from 'ionicons/icons';
import { changeEmailForm } from '../../profile/profile.form';

export interface EmailUpdateRequest {
	emailAddress: string;
	password: string;
}

@Component({
	selector: 'app-submit-card',
	templateUrl: './submit-card.component.html',
	styleUrls: ['./submit-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, NiceFormErrorPipe, DatePipe, TimeSlotPipe, TranslateModule, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonInput, IonItem, IonLabel, IonList],
})
export class SubmitCardComponent {
	public readonly children = input<Child[]>([]);
	public readonly dateTimeSlot = input<DateTimeSlot | null | undefined>();
	public readonly emailAddress = input('');
	public readonly canSubmit = input(false);
	public readonly busy = input(false);
	public readonly submitRequested = output<void>();
	public readonly emailUpdateRequested = output<EmailUpdateRequest>();
	public readonly expanded = signal(false);
	public readonly emailUpdateOpen = signal(false);
	public readonly changeEmailForm = changeEmailForm();

	constructor() {
		addIcons({ checkmarkCircleOutline, manOutline, womanOutline, happyOutline });
		effect(() => {
			if (
				typeof window !== 'undefined' &&
				window.location.hash === '#review' &&
				this.canSubmit()
			) {
				this.expanded.set(true);
			}
		});
	}

	public open(): void {
		if (this.canSubmit()) this.expanded.set(true);
	}

	public submit(): void {
		if (this.canSubmit() && !this.busy()) this.submitRequested.emit();
	}

	public openEmailUpdate(): void {
		if (!this.busy()) this.emailUpdateOpen.set(true);
	}

	public cancelEmailUpdate(): void {
		this.changeEmailForm.reset();
		this.emailUpdateOpen.set(false);
	}

	public updateEmail(): void {
		if (this.changeEmailForm.invalid || this.busy()) {
			this.changeEmailForm.markAllAsTouched();
			return;
		}
		const value = this.changeEmailForm.getRawValue();
		this.emailUpdateRequested.emit({
			emailAddress: value.emailAddress!,
			password: value.password!,
		});
	}

	public completeEmailUpdate(): void {
		this.cancelEmailUpdate();
	}
}
