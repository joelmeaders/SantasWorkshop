import {
	ChangeDetectorRef,
	ChangeDetectionStrategy,
	Component,
	inject,
	viewChild,
} from '@angular/core';
import {
	AlertController,
	ModalController,
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonLabel,
	IonCard,
	IonCardHeader,
	IonCardTitle,
	IonCardSubtitle,
	IonCardContent,
	IonList,
	IonItemGroup,
	IonItemDivider,
	IonItem,
	IonInput,
	IonNote,
	IonText,
	IonCheckbox,
	IonSpinner,
} from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
	AnalyticsWrapper,
	AppStateService,
	NiceFormErrorPipe,
} from '@santashop/core/customer';
import { PrivacyPolicyModalComponent } from '../../../shared/components/privacy-policy-modal/privacy-policy-modal.component';
import { TermsOfServiceModalComponent } from '../../../shared/components/terms-of-service-modal/terms-of-service-modal.component';
import { SignUpPageService } from './sign-up.page.service';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { ReferralSelectionModalComponent } from './referral-selection-modal/referral-selection-modal.component';
import { LanguageToggleComponent } from '../../../shared/components/language-toggle/language-toggle.component';

import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';

@Component({
	selector: 'app-sign-up',
	templateUrl: './sign-up.page.html',
	styleUrls: ['./sign-up.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [SignUpPageService],
	imports: [
		RouterLink,
		ReactiveFormsModule,
		TranslateModule,
		NiceFormErrorPipe,
		AsyncPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonLabel,
		IonCard,
		IonCardHeader,
		IonCardTitle,
		IonCardSubtitle,
		IonCardContent,
		IonList,
		IonItemGroup,
		IonItemDivider,
		IonItem,
		IonInput,
		IonNote,
		IonText,
		IonCheckbox,
		IonSpinner,
		LanguageToggleComponent,
	],
})
export class SignUpPage {
	private readonly changeDetectorRef = inject(ChangeDetectorRef);
	private readonly viewService = inject(SignUpPageService);
	private readonly alertController = inject(AlertController);
	private readonly translateService = inject(TranslateService);
	private readonly modalController = inject(ModalController);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly appStateService = inject(AppStateService);

	public readonly form = this.viewService.form;

	private readonly firstName = viewChild<HTMLIonInputElement>('firstName');

	public readonly createAccountEnabled$ =
		this.appStateService.createAccountEnabled$;

	constructor() {
		addIcons({ arrowBackSharp });
	}

	public ionViewWillEnter(): void {
		setTimeout(() => this.firstName()?.setFocus(), 300);
	}

	public async onCreateAccount(): Promise<void> {
		if (await this.userConfirmedEmail())
			await this.viewService.onboardUser();
	}

	public async showReferralModal(): Promise<void> {
		const modal = await this.modalController.create({
			component: ReferralSelectionModalComponent,
			componentProps: {
				currentValue: this.form.controls.referredBy.value,
			},
		});

		await modal.present();
		const result = await modal.onDidDismiss<string>();

		if (result.role === 'confirm' && result.data) {
			this.form.controls.referredBy.setValue(result.data);
			this.form.controls.referredBy.markAsTouched();
			this.changeDetectorRef.markForCheck();
		}
	}

	public displayReferral(value: string | undefined): string {
		if (!value) return '';
		if (value.startsWith('Other:')) {
			return `${this.translateService.instant('REFERRAL.OTHER')}: ${value.slice('Other:'.length)}`;
		}

		return value;
	}

	private async userConfirmedEmail(): Promise<boolean> {
		const emailAddress = this.form.controls.emailAddress.value;

		if (!emailAddress) return false;

		const alert = await this.alertController.create({
			header: this.translateService.instant('SIGNUP.CONFIRM_EMAIL'),
			subHeader: emailAddress,
			message: this.translateService.instant('SIGNUP.CONFIRM_EMAIL_MSG'),
			buttons: [
				{
					text: this.translateService.instant('COMMON.GO_BACK'),
					role: 'cancel',
				},
				{
					text: this.translateService.instant('COMMON.YES'),
					role: 'confirm',
					cssClass: 'confirm-delete-button',
				},
			],
		});

		await alert.present();
		const shouldContinue = await alert.onDidDismiss();

		this.analytics.logEventWithParams('confirmed_email', {
			value: shouldContinue.role,
		});

		return shouldContinue.role === 'confirm';
	}

	public async showPrivacyPolicyModal(): Promise<void> {
		this.analytics.logEvent('viewed_privacypolicy');
		const modal = await this.modalController.create({
			component: PrivacyPolicyModalComponent,
		});
		return modal.present();
	}

	public async showTermsConditionsModal(): Promise<void> {
		this.analytics.logEvent('viewed_termsofservice');
		const modal = await this.modalController.create({
			component: TermsOfServiceModalComponent,
		});
		return modal.present();
	}
}
