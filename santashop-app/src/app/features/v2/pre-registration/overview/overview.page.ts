import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	PLATFORM_ID,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { isPlatformBrowser, AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
	AnalyticsWrapper,
	AuthService,
	FireRepoLite,
	IFireRepoCollection,
	PROGRAM_YEAR,
	timestampToDate,
	validateChild,
} from '@santashop/core';
import {
	COLLECTION_SCHEMA,
	Child,
	DateTimeSlot,
} from '@santashop/models';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { filter, map, shareReplay, take, takeUntil, timeout } from 'rxjs/operators';
import { where } from 'firebase/firestore';
import { PreRegistrationService } from '../../../../core';
import { ChildSaveRequest, ChildrenCardComponent } from './children-card/children-card.component';
import { ScheduleCardComponent } from './schedule-card/schedule-card.component';
import {
	EmailUpdateRequest,
	SubmitCardComponent,
} from './submit-card/submit-card.component';
import {
	AlertController,
	IonCol,
	IonButton,
	IonContent,
	IonGrid,
	IonIcon,
	IonRow,
	ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowDownCircleOutline } from 'ionicons/icons';

@Component({
	selector: 'app-overview',
	templateUrl: './overview.page.html',
	styleUrls: ['./overview.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ChildrenCardComponent,
		ScheduleCardComponent,
		SubmitCardComponent,
		AsyncPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		TranslateModule,
	],
})
export class OverviewPage implements AfterViewInit, OnDestroy {
	private readonly preregistrationService = inject(PreRegistrationService);
	private readonly authService = inject(AuthService);
	private readonly fireRepo = inject(FireRepoLite);
	private readonly router = inject(Router);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly alertController = inject(AlertController);
	private readonly toastController = inject(ToastController);
	private readonly translateService = inject(TranslateService);
	private readonly platformId = inject(PLATFORM_ID);
	private readonly destroy$ = new Subject<void>();
	private readonly childrenCard = viewChild(ChildrenCardComponent);
	private readonly scheduleCard = viewChild(ScheduleCardComponent);
	private readonly submitCard = viewChild(SubmitCardComponent);

	public readonly programYear = inject(PROGRAM_YEAR);
	public readonly userRegistration$ = this.preregistrationService.userRegistration$;
	public readonly children$ = this.preregistrationService.children$;
	public readonly childCount$ = this.preregistrationService.childCount$;
	public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;
	public readonly registrationSubmitted$ = this.preregistrationService.registrationSubmitted$;
	public readonly emailAddress$ = this.userRegistration$.pipe(
		map((registration) => registration?.emailAddress ?? ''),
		shareReplay(1),
	);
	public readonly isSaving = signal(false);
	public readonly reviewing = signal(false);

	constructor() {
		addIcons({ arrowDownCircleOutline });
	}

	public readonly canChooseDateTime$ = combineLatest([
		this.childCount$,
		this.preregistrationService.noErrorsInChildren$,
	]).pipe(
		map(([childCount, noErrors]) => childCount >= 1 && noErrors),
		shareReplay(1),
	);

	public readonly canSubmit$ = combineLatest([
		this.canChooseDateTime$,
		this.dateTimeSlot$,
		this.registrationSubmitted$,
	]).pipe(
		map(([canChooseDateTime, dateTimeSlot, submitted]) =>
			canChooseDateTime && !!dateTimeSlot && !submitted,
		),
		shareReplay(1),
	);

	public readonly availableSlots$ = this.dateTimeSlotCollection()
		.readMany([where('programYear', '==', this.programYear)], 'id')
		.pipe(
			takeUntil(this.destroy$),
			map((slots) =>
				slots
					.map((slot) => ({
						...slot,
						dateTime: timestampToDate(slot.dateTime),
					}))
					.sort((left, right) => left.dateTime.valueOf() - right.dateTime.valueOf()),
			),
			shareReplay(1),
		);

	public ngAfterViewInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		window.addEventListener('hashchange', this.focusHashSection);
		this.focusHashSection();
	}

	public ionViewWillEnter(): void {
		this.reviewing.set(false);
	}

	public ngOnDestroy(): void {
		if (isPlatformBrowser(this.platformId)) {
			window.removeEventListener('hashchange', this.focusHashSection);
		}
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async saveChild(request: ChildSaveRequest): Promise<void> {
		const saved = await this.runWorkspaceAction('Child saved. You can now choose an appointment.', async () => {
			const child = request.child;
			const validatedChild = validateChild({ ...child });
			delete validatedChild.error;
			await this.preregistrationService.saveDraftChild({
				mutationId: this.createMutationId(),
				child: validatedChild,
			});
			this.analytics.logEventWithParams('workspace_child_saved', {
				childId: validatedChild.id,
			});
		});
		if (!saved) return;
		if (request.isNew) await this.askAboutAnotherChild();
		else this.childrenCard()?.collapseEditor();
	}

	public async deleteChild(child: Child): Promise<void> {
		const deleted = await this.runWorkspaceAction('Child removed.', async () => {
			if (child.id === undefined) throw new Error('This child could not be removed.');
			await this.preregistrationService.deleteDraftChild({
				mutationId: this.createMutationId(),
				childId: child.id,
			});
			this.analytics.logEventWithParams('workspace_child_removed', {
				childId: child.id,
			});
		});
		if (deleted) this.childrenCard()?.collapseEditor();
	}

	public async chooseDateTime(slot?: DateTimeSlot): Promise<void> {
		if (!slot) return;
		await this.runWorkspaceAction(
			'Appointment saved. Review your registration when ready.',
			async () => {
				if (!slot.enabled || !slot.id) {
					throw new Error('That appointment is no longer available. Please choose another time.');
				}
				await this.preregistrationService.setDraftAppointment({
					mutationId: this.createMutationId(),
					slotId: slot.id,
				});
				this.analytics.logEventWithParams('workspace_appointment_saved', {
					slotId: slot.id,
				});
			},
		);
	}

	public async submitRegistration(): Promise<void> {
		await this.runWorkspaceAction('Registration submitted. Opening your confirmation.', async () => {
			const result = await this.preregistrationService.completeRegistration({
				mutationId: this.createMutationId(),
			});
			if (!result.data) throw new Error('We could not submit your registration. Please try again.');
			await firstValueFrom(
				this.preregistrationService.registrationComplete$.pipe(
					filter(Boolean),
					take(1),
					timeout(15000),
				),
			);
			this.analytics.logEvent('submit_registration');
			await this.router.navigate(['/pre-registration/confirmation']);
		});
	}

	public async updateEmailAddress(request: EmailUpdateRequest): Promise<void> {
		const updated = await this.runWorkspaceAction(
			'Email address updated. Your ticket will be sent there.',
			async () => {
				await this.authService.changeEmailAddress(
					request.password,
					request.emailAddress,
				);
				this.analytics.logEvent('workspace_email_updated');
			},
		);
		if (updated) this.submitCard()?.completeEmailUpdate();
	}

	public startReview(): void {
		this.childrenCard()?.collapseEditor();
		this.scheduleCard()?.collapse();
		this.reviewing.set(true);
	}

	public makeChanges(): void {
		this.reviewing.set(false);
	}

	public reviewAndSubmit(): void {
		const card = this.submitCard();
		if (!card?.canSubmit()) return;

		this.analytics.logEvent('workspace_completion_nudge_clicked');
		card.open();

		if (!isPlatformBrowser(this.platformId)) return;
		window.setTimeout(() => {
			const reviewSection = document.getElementById('review');
			if (!reviewSection) return;
			const reduceMotion =
				typeof window.matchMedia === 'function' &&
				window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			reviewSection.focus({ preventScroll: true });
			reviewSection.scrollIntoView({
				behavior: reduceMotion ? 'auto' : 'smooth',
				block: 'start',
			});
		});
	}

	private readonly focusHashSection = (): void => {
		const hash = window.location.hash.replace('#', '');
		if (!['children', 'appointment', 'review'].includes(hash)) return;
		window.setTimeout(() => document.getElementById(hash)?.focus());
	};

	private dateTimeSlotCollection(): IFireRepoCollection<DateTimeSlot> {
		return this.fireRepo.collection<DateTimeSlot>(COLLECTION_SCHEMA.dateTimeSlots);
	}

	private createMutationId(): string {
		if (typeof globalThis.crypto?.randomUUID === 'function') {
			return globalThis.crypto.randomUUID();
		}
		return `mutation_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
	}

	private async runWorkspaceAction(
		successMessage: string,
		action: () => Promise<void>,
	): Promise<boolean> {
		this.isSaving.set(true);
		try {
			await action();
			await this.presentWorkspaceToast(successMessage, 'success');
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'We could not save your changes. Please try again.';
			await this.presentWorkspaceToast(message, 'danger');
			return false;
		} finally {
			this.isSaving.set(false);
		}
	}

	private async presentWorkspaceToast(
		message: string,
		color: 'success' | 'danger',
	): Promise<void> {
		try {
			await this.toastController.dismiss(undefined, undefined, 'workspace-toast');
		} catch {
			// The previous toast may have already been dismissed by Ionic.
		}
		const toast = await this.toastController.create({
			id: 'workspace-toast',
			message,
			color,
			cssClass: 'workshop-toast',
			duration: color === 'success' ? 4000 : 6500,
			position: 'top',
			swipeGesture: 'vertical',
			htmlAttributes: {
				'aria-live': color === 'success' ? 'polite' : 'assertive',
			},
		});
		await toast.present();
	}

	private async askAboutAnotherChild(): Promise<void> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('OVERVIEW.ANOTHER_CHILD_TITLE'),
			message: this.translateService.instant('OVERVIEW.ANOTHER_CHILD_MESSAGE'),
			backdropDismiss: false,
			buttons: [
				{
					text: this.translateService.instant('COMMON.NO'),
					role: 'cancel',
				},
				{
					text: this.translateService.instant('COMMON.YES'),
					role: 'confirm',
				},
			],
		});
		await alert.present();
		const result = await alert.onDidDismiss();
		if (result.role === 'confirm') {
			this.childrenCard()?.openNewChild();
			return;
		}
		this.childrenCard()?.collapseEditor();
	}
}
