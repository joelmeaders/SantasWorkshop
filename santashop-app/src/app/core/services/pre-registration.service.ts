import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
	map,
	mergeMap,
	shareReplay,
	switchMap,
	take,
	takeUntil,
} from 'rxjs/operators';
import { Timestamp } from '@firebase/firestore';
import {
	DateTimeSlot,
	Registration,
	Child,
	COLLECTION_SCHEMA,
} from '@models/*';
import { Functions } from '@angular/fire/functions';
import { httpsCallable } from 'rxfire/functions';
import { DocumentReference } from '@angular/fire/firestore';
import {
	AuthService,
	automock,
	filterNil,
	FireRepoLite,
	pluckFilterNil,
} from '@core/*';
import { QrCodeService } from './qrcode.service';

@Injectable({
	providedIn: 'root',
})
export class PreRegistrationService implements OnDestroy {
	private readonly registrationCollection = () =>
		this.fireRepo.collection<Registration>(
			COLLECTION_SCHEMA.registrations
		);

	private readonly destroy$ = new Subject<void>();

	@automock
	public readonly userRegistration$ = this.authService.uid$.pipe(
		takeUntil(this.destroy$),
		filterNil(),
		mergeMap((uid) => this.registrationCollection().read(uid, 'uid')),
		shareReplay(1)
	);

	@automock
	public readonly registrationComplete$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map(this.isRegistrationComplete),
		shareReplay(1)
	);

	@automock
	public readonly registrationSubmitted$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => !!registration.registrationSubmittedOn),
		shareReplay(1)
	);

	@automock
	public readonly children$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => this.getChildren(registration)),
		shareReplay(1)
	);

	@automock
	public readonly childCount$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		map((registration) => registration?.children?.length ?? 0),
		shareReplay(1)
	);

	@automock
	public readonly noErrorsInChildren$ = this.children$.pipe(
		takeUntil(this.destroy$),
		map((children) => children.filter((c) => !!c.error)),
		map((errors) => errors.length === 0),
		shareReplay(1)
	);

	@automock
	public readonly dateTimeSlot$: Observable<DateTimeSlot | undefined> =
		this.userRegistration$.pipe(
			takeUntil(this.destroy$),
			map((registration) => this.getDateTimeSlot(registration)),
			shareReplay(1)
		);

	@automock
	public readonly qrCode$ = this.userRegistration$.pipe(
		takeUntil(this.destroy$),
		pluckFilterNil('uid'),
		mergeMap((uid) => this.qrCodeService.registrationQrCodeUrl(uid)),
		shareReplay(1)
	);

	constructor(
		private readonly fireRepo: FireRepoLite,
		private readonly authService: AuthService,
		private readonly qrCodeService: QrCodeService,
		private readonly afFunctions: Functions
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	// TODO: Convert to function
	public saveRegistration(
		registration: Registration
	): Observable<DocumentReference> {
		this.validateRegistration(registration);

		return this.authService.uid$.pipe(take(1)).pipe(
			take(1),
			switchMap((uid) =>
				this.registrationCollection().update(uid, registration, false)
			)
		);
	}

	public undoRegistration() {
		const accountStatusFunction = httpsCallable<any, boolean>(
			this.afFunctions,
			'undoRegistration'
		);
		return accountStatusFunction({});
	}

	public isRegistrationComplete(registration: Registration): boolean {
		const hasChildren = registration.children?.length;
		const hasDateTime = registration.dateTimeSlot?.dateTime;
		const isSubmitted = registration.registrationSubmittedOn;
		return !!hasChildren && !!hasDateTime && !!isSubmitted;
	}

	// TODO: Make cloud function to handle this
	private validateRegistration(registration: Registration): void {
		registration = registration;
	}

	private getDateTimeSlot(
		registration: Registration
	): DateTimeSlot | undefined {
		const slot = registration?.dateTimeSlot as DateTimeSlot;

		// Convert the timestamp to a date. Firebase (or angularfire) seems to be
		// setting all dates to timestamps in the database now.
		if (slot) slot.dateTime = ((<any>slot.dateTime) as Timestamp)?.toDate();

		return slot;
	}

	private getChildren(registration: Registration): Child[] {
		registration.children?.forEach((child) => {
			child.dateOfBirth = (
				(<any>child.dateOfBirth) as Timestamp
			)?.toDate();
		});

		return (registration.children as Child[]) ?? new Array<Child>();
	}
}
