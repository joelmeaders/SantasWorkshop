import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
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
} from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { AppStateService } from '../../../core';
import { PrivacyPolicyModalComponent } from '../../../shared/components/privacy-policy-modal/privacy-policy-modal.component';
import { TermsOfServiceModalComponent } from '../../../shared/components/terms-of-service-modal/terms-of-service-modal.component';
import { RegistrationClosedPage } from '../../registration-closed/registration-closed.page';
import { SignUpPageService } from './sign-up.page.service';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { CoreModule } from '@santashop/core';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';

@Component({
	selector: 'app-sign-up',
	templateUrl: './sign-up.page.html',
	styleUrls: ['./sign-up.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [SignUpPageService],
	standalone: true,
	imports: [
		RouterLink,
		ReactiveFormsModule,
		NgIf,
		TranslateModule,
		CoreModule,
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
	],
})
export class SignUpPage {
	public readonly form = this.viewService.form;

	@ViewChild('firstName') private readonly firstName?: HTMLIonInputElement;

	public readonly createAccountEnabled$ =
		this.appStateService.createAccountEnabled$;

	protected readonly closedSubscription =
		this.appStateService.isRegistrationEnabled$
			.pipe(
				tap((enabled) => {
					if (!enabled)
						this.appStateService.setModal(RegistrationClosedPage);
				}),
			)
			.subscribe();

	constructor(
		private readonly viewService: SignUpPageService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
		private readonly modalController: ModalController,
		private readonly analytics: Analytics,
		private readonly appStateService: AppStateService,
	) {
		addIcons({ arrowBackSharp });
	}

	public ionViewWillEnter(): void {
		setTimeout(() => this.firstName?.setFocus(), 300);
	}

	public async onCreateAccount(): Promise<void> {
		if (await this.userConfirmedEmail())
			await this.viewService.onboardUser();
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

		logEvent(this.analytics, 'confirmed_email', {
			value: shouldContinue.role,
		});

		return shouldContinue.role === 'confirm';
	}

	public async showPrivacyPolicyModal(): Promise<void> {
		logEvent(this.analytics, 'viewed_privacypolicy');
		const modal = await this.modalController.create({
			component: PrivacyPolicyModalComponent,
		});
		return modal.present();
	}

	public async showTermsConditionsModal(): Promise<void> {
		logEvent(this.analytics, 'viewed_termsofservice');
		const modal = await this.modalController.create({
			component: TermsOfServiceModalComponent,
		});
		return modal.present();
	}
}
