import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import { AnalyticsWrapper, AuthService } from '@santashop/core';
import { BehaviorSubject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
	IonContent,
	IonButton,
	IonIcon,
	IonGrid,
	IonRow,
	IonCol,
	IonCard,
	IonCardHeader,
	IonTitle,
	IonCardSubtitle,
	IonCardContent,
	IonList,
	IonItem,
	IonInput,
	IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';

@Component({
	selector: 'app-reset-password',
	templateUrl: './reset-password.page.html',
	styleUrls: ['./reset-password.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonContent,
		IonButton,
		IonIcon,
		IonGrid,
		IonRow,
		IonCol,
		IonCard,
		IonCardHeader,
		IonTitle,
		IonCardSubtitle,
		IonCardContent,
		IonList,
		IonItem,
		RouterLink,
		ReactiveFormsModule,
		AsyncPipe,
		TranslateModule,
		IonContent,
		IonButton,
		IonIcon,
		IonGrid,
		IonRow,
		IonCol,
		IonCard,
		IonCardHeader,
		IonTitle,
		IonCardSubtitle,
		IonCardContent,
		IonList,
		IonItem,
		IonInput,
		IonText,
	],
})
export class ResetPasswordPage {
	private readonly formBuilder = inject(FormBuilder);
	private readonly authService = inject(AuthService);
	private readonly analytics = inject(AnalyticsWrapper);

	public readonly form: FormGroup = this.formBuilder.group({
		emailAddress: [
			undefined,
			Validators.compose([Validators.required, Validators.email]),
		],
	});

	private readonly resetEmailSent = new BehaviorSubject<boolean>(false);
	public readonly resetEmailSent$ = this.resetEmailSent
		.asObservable()
		.pipe(shareReplay(1));

	constructor() {
		addIcons({ arrowBackSharp });
	}

	public resetPage(): void {
		this.form.controls['emailAddress'].setValue(undefined);
		this.form.markAsPristine();
		this.resetEmailSent.next(false);
	}

	public async resetPassword(): Promise<void> {
		const email = this.form.get('emailAddress')?.value;

		this.analytics.logEvent('reset_password');

		await this.authService.resetPassword(email).then(() => {
			this.resetEmailSent.next(true);
		});
	}
}
