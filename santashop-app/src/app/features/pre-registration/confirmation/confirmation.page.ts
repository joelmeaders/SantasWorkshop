import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	computed,
	inject,
	viewChild,
	signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
	AnalyticsWrapper,
	trackAnalyticsOperation,
	ErrorHandlerService,
	AppStateService,
	dateToCalendarString,
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
import { PreRegistrationService } from '../../../core';
import { LocalizedDatePipe } from '../../../shared/pipes/localized-date.pipe';
import { addIcons } from 'ionicons';
import { manOutline, womanOutline, happyOutline } from 'ionicons/icons';
import { ChangeDatetimeModalComponent } from './change-datetime-modal/change-datetime-modal.component';
import { DateTimeSlotsService } from './date-time-slots.service';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-confirmation',
	templateUrl: './confirmation.page.html',
	styleUrls: ['./confirmation.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [DateTimeSlotsService],
	imports: [
		LocalizedDatePipe,
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
	public readonly mutationPending = signal(false);
	private intentUid?: string;
	private cancellationId?: string;
	private appointmentIntent?: { mutationId: string; slot: DateTimeSlot };
	private resetPendingForIdentity(): void {
		const uid = this.viewService.currentIdentityKey;
		if (uid !== this.intentUid) {
			this.intentUid = uid;
			this.cancellationId = undefined;
			this.appointmentIntent = undefined;
		}
	}

	public readonly calendarDate = dateToCalendarString;
	public readonly viewService = inject(PreRegistrationService);
	private readonly loadingController = inject(LoadingController);
	private readonly destroyRef = inject(DestroyRef);
	private readonly alertController = inject(AlertController);
	private readonly modalController = inject(ModalController);
	private readonly router = inject(Router);
	private readonly errorHandler = inject(ErrorHandlerService);
	private readonly translateService = inject(TranslateService);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly appStateService = inject(AppStateService);
	private readonly dateTimeService = inject(DateTimeSlotsService);
	private readonly content = viewChild.required(IonContent);
	private readonly eventInformation =
		viewChild.required<ElementRef<HTMLElement>>('eventInformation');

	public readonly qrCode = toSignal(this.viewService.qrCode$, {
		initialValue: undefined,
	});
	public readonly dateTimeSlot = toSignal(this.viewService.dateTimeSlot$, {
		initialValue: undefined,
	});
	public readonly children = toSignal(this.viewService.children$, {
		initialValue: [],
	});
	private readonly hasCheckedIn = toSignal(this.viewService.hasCheckedIn$, {
		initialValue: undefined,
	});

	private readonly allowChange = toSignal(
		this.appStateService.allowChangeRegistration$,
		{ initialValue: false },
	);
	private readonly allowCancel = toSignal(
		this.appStateService.allowCancelRegistration$,
		{ initialValue: false },
	);
	public readonly allowChangeRegistration = computed(
		() => this.allowChange() && this.hasCheckedIn() === false,
	);
	public readonly allowCancelRegistration = computed(
		() => this.allowCancel() && this.hasCheckedIn() === false,
	);

	constructor() {
		addIcons({ manOutline, womanOutline, happyOutline });
	}

	public get encodedEventAddress(): string {
		return encodeURIComponent(
			[
				this.translateService.instant('EVENT_INFO.EVENT_ADDRESS1'),
				this.translateService.instant('EVENT_INFO.EVENT_ADDRESS2'),
			].join(', '),
		);
	}

	public async showEventInformation(): Promise<void> {
		const target = this.eventInformation().nativeElement;
		const content = this.content();
		const scrollElement = await content.getScrollElement();
		const top =
			scrollElement.scrollTop +
			target.getBoundingClientRect().top -
			scrollElement.getBoundingClientRect().top;
		const reduceMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches;
		await content.scrollToPoint(undefined, top, reduceMotion ? 0 : 300);
		target.focus({ preventScroll: true });
	}

	public async undoRegistration(): Promise<void> {
		if (this.mutationPending()) return;
		this.mutationPending.set(true);
		this.resetPendingForIdentity();
		const uid = this.intentUid;
		try {
			const alert = await this.alertController.create({
				header: this.translateService.instant(
					'CONFIRMATION.ARE_YOU_SURE',
				),
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
			if (!this.isCurrentIdentity(uid)) return;
			const recovering = !!this.cancellationId;
			const mutationId = (this.cancellationId ??= crypto.randomUUID());

			const loader = await this.loadingController.create({
				message: this.translateService.instant(
					'CONFIRMATION.CANCELLING_REGISTRATION',
				),
			});

			await loader.present();

			try {
				if (!this.isCurrentIdentity(uid)) return;
				await trackAnalyticsOperation(
					this.analytics,
					'registration_cancel',
					() =>
						this.viewService.undoRegistration(
							mutationId,
							recovering,
						),
				);
				if (!this.isCurrentIdentity(uid)) return;
				this.cancellationId = undefined;
				this.analytics.logEvent('cancel_registration');
				await this.router.navigate(['/pre-registration/overview']);
			} catch (error) {
				await this.errorHandler.handleError(error as IError);
			} finally {
				await loader.dismiss().catch(() => false);
			}
		} finally {
			this.mutationPending.set(false);
		}
	}

	public async changeRegistration(): Promise<void> {
		if (this.mutationPending()) return;
		this.mutationPending.set(true);
		this.resetPendingForIdentity();
		const uid = this.intentUid;
		try {
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
			if (!this.isCurrentIdentity(uid)) return;
			const selected = result.data;
			if (
				!this.appointmentIntent ||
				this.appointmentIntent.slot.id !== selected.id ||
				this.appointmentIntent.slot.dateTime.getTime() !==
					selected.dateTime.getTime()
			) {
				this.appointmentIntent = {
					mutationId: crypto.randomUUID(),
					slot: {
						...selected,
						dateTime: new Date(selected.dateTime),
					},
				};
			}
			const intent = this.appointmentIntent;

			const loader = await this.loadingController.create({
				message: this.translateService.instant(
					'CONFIRMATION.UPDATING_REGISTRATION',
				),
			});

			await loader.present();

			try {
				if (!this.isCurrentIdentity(uid)) return;
				await trackAnalyticsOperation(
					this.analytics,
					'appointment_change',
					() =>
						this.viewService.changeRegistrationDateTime(
							intent.slot,
							intent.mutationId,
						),
				);
				if (!this.isCurrentIdentity(uid)) return;
				this.appointmentIntent = undefined;
				this.analytics.logEvent('change_registration_datetime');

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
				const details = (error as { details?: { reason?: string } })
					?.details;
				if (details?.reason === 'appointment-review-required') {
					await this.errorHandler.handleError({
						message: this.translateService.instant(
							'OVERVIEW.APPOINTMENT_REVIEW_REQUIRED',
						),
					} as IError);
				} else {
					await this.errorHandler.handleError(error as IError);
				}
			} finally {
				await loader.dismiss().catch(() => false);
			}
		} finally {
			this.mutationPending.set(false);
		}
	}

	private isCurrentIdentity(identity: string | undefined): boolean {
		return (
			!this.destroyRef.destroyed &&
			identity === this.viewService.currentIdentityKey
		);
	}
}
