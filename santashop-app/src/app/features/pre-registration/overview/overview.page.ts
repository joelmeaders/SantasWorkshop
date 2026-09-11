import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	PLATFORM_ID,
	computed,
	effect,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { COLLECTION_SCHEMA, Child, DateTimeSlot } from '@santashop/models';
import { BehaviorSubject, firstValueFrom, switchMap } from 'rxjs';
import { filter, map, take, timeout } from 'rxjs/operators';
import { where } from 'firebase/firestore';
import { PreRegistrationService } from '../../../core';
import {
	ChildSaveRequest,
	ChildrenCardComponent,
} from './children-card/children-card.component';
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
	private readonly childrenCard = viewChild(ChildrenCardComponent);
	private readonly scheduleCard = viewChild(ScheduleCardComponent);
	private readonly submitCard = viewChild(SubmitCardComponent);

	public readonly programYear = inject(PROGRAM_YEAR);
	public readonly userRegistration = toSignal(
		this.preregistrationService.userRegistration$,
		{ initialValue: undefined },
	);
	public readonly children = toSignal(this.preregistrationService.children$, {
		initialValue: [],
	});
	public readonly childCount = toSignal(
		this.preregistrationService.childCount$,
		{ initialValue: 0 },
	);
	public readonly dateTimeSlot = toSignal(
		this.preregistrationService.dateTimeSlot$,
		{ initialValue: undefined },
	);
	public readonly registrationSubmitted = toSignal(
		this.preregistrationService.registrationSubmitted$,
		{ initialValue: false },
	);
	private readonly noErrorsInChildren = toSignal(
		this.preregistrationService.noErrorsInChildren$,
		{ initialValue: false },
	);
	public readonly emailAddress = computed(
		() => this.userRegistration()?.emailAddress ?? '',
	);
	public readonly isSaving = signal(false);
	public readonly reviewing = signal(false);
	private readonly slotRefresh = new BehaviorSubject<void>(undefined);
	private pendingCompletionId?: string;
	private completionUid?: string;

	constructor() {
		addIcons({ arrowDownCircleOutline });
		effect(() => {
			const uid = this.userRegistration()?.uid;
			if (uid !== this.completionUid) {
				this.completionUid = uid;
				this.pendingCompletionId = undefined;
			}
			if (this.registrationSubmitted() && this.pendingCompletionId) {
				this.pendingCompletionId = undefined;
				void this.router.navigate(['/pre-registration/confirmation']);
			}
		});
	}

	public readonly canChooseDateTime = computed(
		() => this.childCount() >= 1 && this.noErrorsInChildren(),
	);

	public readonly canSubmit = computed(
		() =>
			this.canChooseDateTime() &&
			!!this.dateTimeSlot() &&
			!this.registrationSubmitted(),
	);

	public readonly availableSlots = toSignal(
		this.slotRefresh
			.pipe(
				switchMap(() =>
					this.dateTimeSlotCollection().readMany(
						[where('programYear', '==', this.programYear)],
						'id',
					),
				),
			)
			.pipe(
				map((slots) =>
					slots
						.map((slot) => ({
							...slot,
							dateTime: timestampToDate(slot.dateTime),
						}))
						.sort(
							(left, right) =>
								left.dateTime.valueOf() -
								right.dateTime.valueOf(),
						),
				),
			),
		{ initialValue: undefined },
	);

	public ngAfterViewInit(): void {
		if (!isPlatformBrowser(this.platformId)) return;
		window.addEventListener('hashchange', this.focusHashSection);
		document.addEventListener('visibilitychange', this.resumeReview);
		window.addEventListener('online', this.resumeReview);
		this.focusHashSection();
	}

	public ionViewWillEnter(): void {
		this.reviewing.set(false);
	}

	public ngOnDestroy(): void {
		if (isPlatformBrowser(this.platformId)) {
			window.removeEventListener('hashchange', this.focusHashSection);
			document.removeEventListener('visibilitychange', this.resumeReview);
			window.removeEventListener('online', this.resumeReview);
		}
	}

	public async saveChild(request: ChildSaveRequest): Promise<void> {
		const saved = await this.runWorkspaceAction(
			this.translateService.instant('OVERVIEW.CHILD_SAVED'),
			async () => {
				const child = request.child;
				const validatedChild = validateChild(
					{ ...child },
					this.programYear,
				);
				delete validatedChild.error;
				await this.preregistrationService.saveDraftChild({
					mutationId: this.createMutationId(),
					child: validatedChild,
				});
				this.analytics.logEventWithParams('workspace_child_saved', {
					childId: validatedChild.id,
				});
			},
		);
		if (!saved) return;
		if (request.isNew) await this.askAboutAnotherChild();
		else this.childrenCard()?.collapseEditor();
	}

	public async deleteChild(child: Child): Promise<void> {
		const deleted = await this.runWorkspaceAction(
			this.translateService.instant('OVERVIEW.CHILD_REMOVED'),
			async () => {
				if (child.id === undefined)
					throw new Error(
						this.translateService.instant(
							'OVERVIEW.CHILD_REMOVE_FAILED',
						),
					);
				await this.preregistrationService.deleteDraftChild({
					mutationId: this.createMutationId(),
					childId: child.id,
				});
				this.analytics.logEventWithParams('workspace_child_removed', {
					childId: child.id,
				});
			},
		);
		if (deleted) this.childrenCard()?.collapseEditor();
	}

	public async chooseDateTime(slot?: DateTimeSlot): Promise<void> {
		if (!slot) return;
		await this.runWorkspaceAction(
			this.translateService.instant('OVERVIEW.APPOINTMENT_SAVED'),
			async () => {
				if (!slot.enabled || !slot.id) {
					throw new Error(
						this.translateService.instant(
							'OVERVIEW.APPOINTMENT_UNAVAILABLE',
						),
					);
				}
				await this.preregistrationService.setDraftAppointment({
					mutationId: this.createMutationId(),
					slotId: slot.id,
					reviewedDateTime: slot.dateTime.toISOString(),
				});
				this.reviewing.set(false);
				this.analytics.logEventWithParams(
					'workspace_appointment_saved',
					{
						slotId: slot.id,
					},
				);
			},
		);
	}

	public async submitRegistration(): Promise<void> {
		await this.runWorkspaceAction(
			this.translateService.instant('OVERVIEW.REGISTRATION_SUBMITTED'),
			async () => {
				this.slotRefresh.next();
				const result =
					await this.preregistrationService.completeRegistration({
						mutationId: (this.pendingCompletionId ??=
							this.createMutationId()),
					});
				if (!result.data)
					throw new Error(
						this.translateService.instant('OVERVIEW.SUBMIT_FAILED'),
					);
				await firstValueFrom(
					this.preregistrationService.registrationComplete$.pipe(
						filter(Boolean),
						take(1),
						timeout(15000),
					),
				);
				this.analytics.logEvent('submit_registration');
				this.pendingCompletionId = undefined;
				await this.router.navigate(['/pre-registration/confirmation']);
			},
		);
	}

	public async updateEmailAddress(
		request: EmailUpdateRequest,
	): Promise<void> {
		const updated = await this.runWorkspaceAction(
			this.translateService.instant('OVERVIEW.EMAIL_UPDATED'),
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

	public async startReview(): Promise<void> {
		this.slotRefresh.next();
		this.isSaving.set(true);
		try {
			const slot = this.dateTimeSlot();
			if (!slot?.id) return;
			await this.preregistrationService.setDraftAppointment({
				mutationId: this.createMutationId(),
				slotId: slot.id,
				reviewedDateTime: slot.dateTime.toISOString(),
			});
			this.childrenCard()?.collapseEditor();
			this.scheduleCard()?.collapse();
			this.reviewing.set(true);
		} catch (error) {
			if (!(await this.recoverAppointment(error))) {
				this.reviewing.set(false);
				this.submitCard()?.makeChanges();
				await this.presentWorkspaceToast(
					this.translateService.instant('OVERVIEW.SAVE_FAILED'),
					'danger',
				);
			}
		} finally {
			this.isSaving.set(false);
		}
	}

	private readonly resumeReview = (): void => {
		if (
			document.visibilityState === 'hidden' ||
			this.registrationSubmitted()
		)
			return;
		this.reviewing.set(false);
		this.submitCard()?.makeChanges();
		this.slotRefresh.next();
	};

	private async recoverAppointment(error: unknown): Promise<boolean> {
		const details = (error as { details?: { reason?: string } })?.details;
		if (details?.reason !== 'appointment-review-required') return false;
		this.pendingCompletionId = undefined;
		this.reviewing.set(false);
		this.submitCard()?.makeChanges();
		this.scheduleCard()?.open();
		this.slotRefresh.next();
		await this.presentWorkspaceToast(
			this.translateService.instant(
				'OVERVIEW.APPOINTMENT_REVIEW_REQUIRED',
			),
			'danger',
		);
		return true;
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
		return this.fireRepo.collection<DateTimeSlot>(
			COLLECTION_SCHEMA.dateTimeSlots,
		);
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
			if (await this.recoverAppointment(error)) return false;
			if (this.registrationSubmitted()) {
				this.pendingCompletionId = undefined;
				await this.router.navigate(['/pre-registration/confirmation']);
				return true;
			}
			const message =
				error instanceof Error
					? error.message
					: this.translateService.instant('OVERVIEW.SAVE_FAILED');
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
			await this.toastController.dismiss(
				undefined,
				undefined,
				'workspace-toast',
			);
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
			header: this.translateService.instant(
				'OVERVIEW.ANOTHER_CHILD_TITLE',
			),
			message: this.translateService.instant(
				'OVERVIEW.ANOTHER_CHILD_MESSAGE',
			),
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
