import { Injectable, OnDestroy, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Observable, Subject, of } from 'rxjs';
import {
	catchError,
	map,
	mergeMap,
	shareReplay,
	takeUntil,
	tap,
} from 'rxjs/operators';
import {
	DateTimeSlot,
	Registration,
	Child,
	COLLECTION_SCHEMA,
} from '@santashop/models';
import {
	AuthService,
	AnalyticsWrapper,
	automock,
	filterNil,
	FireRepoLite,
	FunctionsWrapper,
	HttpsCallableResult,
	IFireRepoCollection,
	pluckFilterNil,
	timestampDateFix,
} from '@santashop/core';
import { QrCodeService } from './qrcode.service';

@Injectable({
	providedIn: 'root',
})
export class PreRegistrationService implements OnDestroy {
	private readonly fireRepo = inject(FireRepoLite);
	private readonly authService = inject(AuthService);
	private readonly qrCodeService = inject(QrCodeService);
	private readonly afFunctions = inject(FunctionsWrapper);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly alertController = inject(AlertController);
	private hasReportedUnavailableRegistration = false;

	private readonly registrationCollection =
		(): IFireRepoCollection<Registration> =>
			this.fireRepo.collection<Registration>(
				COLLECTION_SCHEMA.registrations,
			);

	private readonly destroy$ = new Subject<void>();

	@automock
	public readonly userRegistration$ = this.authService.uid$.pipe(
		takeUntil(this.destroy$),
		filterNil(),
		mergeMap((uid) => this.registrationCollection().read(uid, 'uid')),
		catchError(() => {
			void this.reportUnavailableRegistration('unreadable');
			return of(undefined);
		}),
		tap((registration) => {
			if (!registration) void this.reportUnavailableRegistration('missing');
		}),
		shareReplay(1),
	);

	@automock
	public readonly registrationComplete$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) =>
			registration ? this.isRegistrationComplete(registration) : false,
		),
		shareReplay(1),
	);

	@automock
	public readonly registrationSubmitted$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => !!registration?.registrationSubmittedOn),
		shareReplay(1),
	);

	@automock
	public readonly hasCheckedIn$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => !!registration?.hasCheckedIn),
		shareReplay(1),
	);

	@automock
	public readonly children$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => this.getChildren(registration)),
		shareReplay(1),
	);

	@automock
	public readonly childCount$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => registration?.children?.length ?? 0),
		shareReplay(1),
	);

	@automock
	public readonly noErrorsInChildren$ = this.children$.pipe(
		takeUntil(this.destroy$),
		map((children) => children.filter((c) => !!c.error)),
		map((errors) => errors.length === 0),
		shareReplay(1),
	);

	@automock
	public readonly dateTimeSlot$: Observable<DateTimeSlot | undefined> =
		this.userRegistration$.pipe(
			takeUntil(this.destroy$),
			map((registration) => this.getDateTimeSlot(registration)),
			shareReplay(1),
		);

	@automock
	public readonly qrCode$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		filterNil(),
		pluckFilterNil('qrCodeStoragePath'),
		mergeMap((storagePath) =>
			this.qrCodeService.registrationQrCodeUrl(storagePath),
		),
		shareReplay(1),
	);

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public saveDraftChild(input: {
		mutationId: string;
		child: Child;
	}): Promise<HttpsCallableResult<true>> {
		const { child, mutationId } = input;
		if (child.id === undefined) {
			return Promise.reject(new Error('Child ID is required.'));
		}
		return this.afFunctions.saveDraftChild({
			mutationId,
			child: {
				id: child.id,
				firstName: child.firstName,
				lastName: child.lastName,
				dateOfBirth: child.dateOfBirth.toISOString(),
				toyType: child.toyType,
			},
		});
	}

	public deleteDraftChild(input: {
		mutationId: string;
		childId: number;
	}): Promise<HttpsCallableResult<true>> {
		return this.afFunctions.deleteDraftChild(input);
	}

	public setDraftAppointment(input: {
		mutationId: string;
		slotId: string;
	}): Promise<HttpsCallableResult<true>> {
		return this.afFunctions.setDraftAppointment(input);
	}

	public completeRegistration(input: {
		mutationId: string;
	}): Promise<HttpsCallableResult<true>> {
		return this.afFunctions.completeRegistration(input);
	}

	public undoRegistration(): Promise<HttpsCallableResult<true>> {
		return this.afFunctions.undoRegistration({
			mutationId: this.createMutationId(),
		});
	}

	public changeRegistrationDateTime(
		newDateTimeSlot: DateTimeSlot,
	): Promise<HttpsCallableResult<true>> {
		if (!newDateTimeSlot.id) {
			return Promise.reject(new Error('Appointment ID is required.'));
		}
		return this.afFunctions.changeRegistrationDateTime({
			mutationId: this.createMutationId(),
			slotId: newDateTimeSlot.id,
		});
	}

	public isRegistrationComplete(registration: Registration): boolean {
		const hasChildren = registration.children?.length;
		const hasDateTime = registration.dateTimeSlot?.dateTime;
		const isSubmitted = registration.registrationSubmittedOn;
		return !!hasChildren && !!hasDateTime && !!isSubmitted;
	}

	public isRegistrationReadyToSubmit(registration: Registration): boolean {
		const hasChildren = registration.children?.length;
		const hasDateTime = registration.dateTimeSlot?.dateTime;
		const isSubmitted = registration.registrationSubmittedOn;
		return !!hasChildren && !!hasDateTime && !isSubmitted;
	}

	private getDateTimeSlot(
		registration?: Registration,
	): DateTimeSlot | undefined {
		const slot = registration?.dateTimeSlot as DateTimeSlot;
		if (slot) slot.dateTime = timestampDateFix(slot.dateTime);
		return slot;
	}

	private getChildren(registration?: Registration): Child[] {
		registration?.children?.forEach((child) => {
			child.dateOfBirth = timestampDateFix(child.dateOfBirth);
		});

		return (registration?.children as Child[]) ?? new Array<Child>();
	}

	private createMutationId(): string {
		if (typeof globalThis.crypto?.randomUUID === 'function') {
			return globalThis.crypto.randomUUID();
		}
		return `mutation_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
	}

	private async reportUnavailableRegistration(
		reason: 'missing' | 'unreadable',
	): Promise<void> {
		if (this.hasReportedUnavailableRegistration) return;
		this.hasReportedUnavailableRegistration = true;

		this.analytics.logEventWithParams('registration_record_unavailable', {
			reason,
		});

		const alert = await this.alertController.create({
			header: 'Registration record unavailable',
			message:
				'We could not load your registration record. It may be missing or corrupted. Please contact the Denver Santa Claus Shop for assistance.',
			buttons: ['Ok'],
		});

		await alert.present();
	}
}
