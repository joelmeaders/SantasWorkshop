import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
	AnalyticsWrapper,
	ErrorHandlerService,
	AppStateService,
	TimeSlotPipe,
} from '@santashop/core';
import {
	AlertController,
	LoadingController,
	ModalController,
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonCard,
	IonText,
	IonButton,
	IonItem,
	IonList,
	IonIcon,
	IonCardHeader,
	IonCardTitle,
	IonCardSubtitle,
} from '@ionic/angular/standalone';
import { IError, DateTimeSlot } from '@santashop/models';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { PreRegistrationService } from '../../../../core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { addIcons } from 'ionicons';
import { manOutline, womanOutline, happyOutline } from 'ionicons/icons';
import { ChangeDatetimeModalComponent } from './change-datetime-modal/change-datetime-modal.component';
import { DateTimePageService } from '../date-time/date-time.page.service';
import { combineLatest, firstValueFrom, map } from 'rxjs';

@Component({
	selector: 'app-confirmation',
	templateUrl: './confirmation.page.html',
	styleUrls: ['./confirmation.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [DateTimePageService],
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		AsyncPipe,
		DatePipe,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonCard,
		IonText,
		IonButton,
		IonItem,
		IonList,
		IonIcon,
		IonCardHeader,
		IonCardTitle,
		IonCardSubtitle,
		TimeSlotPipe,
	],
})
export class ConfirmationPage {
	public readonly viewService = inject(PreRegistrationService);
	private readonly loadingController = inject(LoadingController);
	private readonly alertController = inject(AlertController);
	private readonly modalController = inject(ModalController);
	private readonly router = inject(Router);
	private readonly errorHandler = inject(ErrorHandlerService);
	private readonly translateService = inject(TranslateService);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly appStateService = inject(AppStateService);
	private readonly dateTimeService = inject(DateTimePageService);

	public readonly isRegistrationComplete$ =
		this.viewService.registrationComplete$;
	public readonly allowChangeRegistration$ = combineLatest({
		allowChange: this.appStateService.allowChangeRegistration$,
		hasCheckedIn: this.viewService.hasCheckedIn$,
	}).pipe(
		map(({ allowChange, hasCheckedIn }) => allowChange && !hasCheckedIn),
	);
	public readonly allowCancelRegistration$ = combineLatest({
		allowCancel: this.appStateService.allowCancelRegistration$,
		hasCheckedIn: this.viewService.hasCheckedIn$,
	}).pipe(
		map(({ allowCancel, hasCheckedIn }) => allowCancel && !hasCheckedIn),
	);

	constructor() {
		addIcons({ manOutline, womanOutline, happyOutline });
	}

	public async undoRegistration(): Promise<void> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('CONFIRMATION.ARE_YOU_SURE'),
			message: this.translateService.instant(
				'CONFIRMATION.CONFIRM_CANCELLATION_MSG',
			),
			buttons: [
				{
					text: this.translateService.instant('COMMON.GO_BACK'),
					role: 'cancel',
					cssClass: 'confirm-delete-button',
				},
				{
					text: this.translateService.instant('COMMON.CONFIRM'),
					role: 'confirm',
				},
			],
		});

		await alert.present();
		const shouldContinue = await alert.onDidDismiss();

		if (shouldContinue.role !== 'confirm') return;

		const loader = await this.loadingController.create({
			message: this.translateService.instant(
				'CONFIRMATION.CANCELLING_REGISTRATION',
			),
		});

		await loader.present();

		try {
			this.analytics.logEvent('cancel_registration');
			await this.viewService.undoRegistration();
			this.router.navigate(['/pre-registration/overview']);
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss();
		}
	}

	public async changeRegistration(): Promise<void> {
		// Check if user has already been checked in
		const hasCheckedIn = await firstValueFrom(
			this.viewService.hasCheckedIn$,
		);

		if (hasCheckedIn) {
			const errorAlert = await this.alertController.create({
				header: this.translateService.instant('COMMON.ERROR'),
				message: this.translateService.instant(
					'CONFIRMATION.CANNOT_CHANGE_AFTER_CHECKIN',
				),
				buttons: ['OK'],
			});
			await errorAlert.present();
			return;
		}

		const alert = await this.alertController.create({
			header: this.translateService.instant('CONFIRMATION.ARE_YOU_SURE'),
			message: this.translateService.instant(
				'CONFIRMATION.CONFIRM_DATETIME_CHANGE_MSG',
			),
			buttons: [
				{
					text: this.translateService.instant('COMMON.GO_BACK'),
					role: 'cancel',
				},
				{
					text: this.translateService.instant('COMMON.CONTINUE'),
					role: 'confirm',
				},
			],
		});

		await alert.present();
		const shouldContinue = await alert.onDidDismiss();

		if (shouldContinue.role !== 'confirm') return;

		// Get the current slot. The modal subscribes to live availability itself.
		const currentSlot = await firstValueFrom(
			this.viewService.dateTimeSlot$,
		);

		if (!currentSlot) {
			await this.errorHandler.handleError({
				message: 'Unable to load registration information',
			} as IError);
			return;
		}

		// Open modal with date/time selection
		const modal = await this.modalController.create({
			component: ChangeDatetimeModalComponent,
			componentProps: {
				currentSlot: currentSlot,
				availableSlots: this.dateTimeService.availableSlots$,
			},
		});

		await modal.present();
		const result = await modal.onDidDismiss<DateTimeSlot>();

		if (result.role !== 'confirm' || !result.data) return;

		const loader = await this.loadingController.create({
			message: this.translateService.instant(
				'CONFIRMATION.UPDATING_REGISTRATION',
			),
		});

		await loader.present();

		try {
			this.analytics.logEvent('change_registration_datetime');
			await this.viewService.changeRegistrationDateTime(result.data);

			// Show success message
			const successAlert = await this.alertController.create({
				header: this.translateService.instant('COMMON.SUCCESS'),
				message: this.translateService.instant(
					'CONFIRMATION.REGISTRATION_UPDATED_MSG',
				),
				buttons: ['OK'],
			});
			await successAlert.present();
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss();
		}
	}
}
