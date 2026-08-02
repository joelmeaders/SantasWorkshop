import { Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
	map,
	mergeMap,
	shareReplay,
	switchMap,
	take,
	takeUntil,
} from 'rxjs/operators';
import {
	DateTimeSlot,
	Registration,
	Child,
	COLLECTION_SCHEMA,
} from '@santashop/models';
import {
	AuthService,
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
import { DocumentReference } from 'firebase/firestore';

@Injectable({
	providedIn: 'root',
})
export class PreRegistrationService implements OnDestroy {
	private readonly fireRepo = inject(FireRepoLite);
	private readonly authService = inject(AuthService);
	private readonly qrCodeService = inject(QrCodeService);
	private readonly afFunctions = inject(FunctionsWrapper);

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
		shareReplay(1),
	);

	@automock
	public readonly registrationReadyToSubmit$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) =>
			registration ? this.isRegistrationReadyToSubmit(registration) : false,
		),
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
		pluckFilterNil('uid'),
		mergeMap((uid) => this.qrCodeService.registrationQrCodeUrl(uid)),
		shareReplay(1),
	);

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public saveRegistration(
		registration: Registration,
	): Observable<DocumentReference<Registration>> {
		return this.authService.uid$.pipe(take(1)).pipe(
			take(1),
			switchMap((uid) =>
				this.registrationCollection().update(uid, registration, false),
			),
		);
	}

	public undoRegistration(): Promise<HttpsCallableResult<unknown>> {
		return this.afFunctions.undoRegistration();
	}

	public changeRegistrationDateTime(
		newDateTimeSlot: DateTimeSlot,
	): Promise<HttpsCallableResult<unknown>> {
		return this.afFunctions.changeRegistrationDateTime({
			newDateTimeSlot,
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
}
