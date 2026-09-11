import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertController } from '@ionic/angular/standalone';
import {
	catchError,
	defer,
	distinctUntilChanged,
	filter,
	map,
	of,
	shareReplay,
	startWith,
	switchMap,
	tap,
} from 'rxjs';
import {
	DateTimeSlot,
	Registration,
	Child,
	COLLECTION_SCHEMA,
} from '@santashop/models';
import {
	AuthService,
	AnalyticsWrapper,
	FireRepoLite,
	FunctionsWrapper,
	HttpsCallableResult,
	dateToCalendarString,
	timestampDateFix,
} from '@santashop/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { QrCodeService } from './qrcode.service';

@Injectable({
	providedIn: 'root',
})
export class PreRegistrationService {
	private readonly fireRepo = inject(FireRepoLite);
	private readonly authService = inject(AuthService);
	private readonly qrCodeService = inject(QrCodeService);
	private readonly afFunctions = inject(FunctionsWrapper);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly alertController = inject(AlertController);
	private readonly translate = inject(TranslateService);
	private hasReportedUnavailableRegistration = false;

	private readonly destroyRef = inject(DestroyRef);
	private registrationUid: string | undefined;
	private registrationVersion = 0;
	private activeUnavailableAlert?: Awaited<
		ReturnType<AlertController['create']>
	>;

	private readonly registrationState$ = this.authService.currentUser$.pipe(
		map((user) => user?.uid),
		distinctUntilChanged(),
		switchMap((uid) => {
			if (uid !== this.registrationUid) {
				this.registrationUid = uid;
				this.registrationVersion++;
				void this.activeUnavailableAlert?.dismiss();
				this.activeUnavailableAlert = undefined;
				this.hasReportedUnavailableRegistration = false;
			}
			if (!uid) return of({ loading: false, registration: undefined });
			return defer(() =>
				this.fireRepo
					.collection<Registration>(COLLECTION_SCHEMA.registrations)
					.read(uid, 'uid'),
			).pipe(
				tap((registration) => {
					if (!registration)
						void this.reportUnavailableRegistration('missing');
				}),
				map((registration) => ({
					loading: false,
					registration: registration
						? this.normalizeRegistration(registration)
						: undefined,
				})),
				catchError(() => {
					void this.reportUnavailableRegistration('unreadable');
					return of({ loading: false, registration: undefined });
				}),
				startWith({ loading: true, registration: undefined }),
			);
		}),
		takeUntilDestroyed(this.destroyRef),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	/** Clears visible data while a different identity is loading. */
	public readonly userRegistration$ = this.registrationState$.pipe(
		map((state) => state.registration),
	);
	/** Route guards must wait for the read; loading is not an incomplete registration. */
	public readonly registrationCompleteResolved$ =
		this.registrationState$.pipe(
			filter((state) => !state.loading),
			map(
				({ registration }) =>
					!!registration && this.isRegistrationComplete(registration),
			),
		);
	public readonly registrationComplete$ = this.userRegistration$.pipe(
		map(
			(registration) =>
				!!registration && this.isRegistrationComplete(registration),
		),
	);
	public readonly registrationSubmitted$ = this.userRegistration$.pipe(
		map((registration) => !!registration?.registrationSubmittedOn),
	);
	public readonly hasCheckedIn$ = this.userRegistration$.pipe(
		map((registration) => !!registration?.hasCheckedIn),
	);
	public readonly children$ = this.userRegistration$.pipe(
		map((registration) => registration?.children ?? []),
	);
	public readonly childCount$ = this.children$.pipe(
		map((children) => children.length),
	);
	public readonly noErrorsInChildren$ = this.children$.pipe(
		map((children) => children.every((child) => !child.error)),
	);
	public readonly dateTimeSlot$ = this.userRegistration$.pipe(
		map(
			(registration) =>
				registration?.dateTimeSlot as DateTimeSlot | undefined,
		),
	);
	public readonly qrCode$ = this.userRegistration$.pipe(
		map((registration) => registration?.qrCodeStoragePath),
		distinctUntilChanged(),
		switchMap((path) =>
			path
				? defer(() =>
						this.qrCodeService.registrationQrCodeUrl(path),
					).pipe(
						catchError(() => of(undefined)),
						startWith(undefined),
					)
				: of(undefined),
		),
		takeUntilDestroyed(this.destroyRef),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	private normalizeRegistration(registration: Registration): Registration {
		return {
			...registration,
			children: registration.children?.map((child) => ({
				...child,
				dateOfBirth: timestampDateFix(child.dateOfBirth),
			})),
			dateTimeSlot: registration.dateTimeSlot && {
				...registration.dateTimeSlot,
				dateTime:
					registration.dateTimeSlot.dateTime &&
					timestampDateFix(registration.dateTimeSlot.dateTime),
			},
		};
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
				dateOfBirth: dateToCalendarString(child.dateOfBirth),
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

		const version = this.registrationVersion;
		const text = await firstValueFrom(
			this.translate.get([
				'REGISTRATION_UNAVAILABLE.TITLE',
				'REGISTRATION_UNAVAILABLE.MESSAGE',
				'COMMON.OK',
			]),
		);
		if (version !== this.registrationVersion || this.destroyRef.destroyed)
			return;
		const alert = await this.alertController.create({
			header: text['REGISTRATION_UNAVAILABLE.TITLE'],
			message: text['REGISTRATION_UNAVAILABLE.MESSAGE'],
			buttons: [text['COMMON.OK']],
		});
		if (version !== this.registrationVersion || this.destroyRef.destroyed)
			return;
		this.activeUnavailableAlert = alert;
		await alert.present();
	}
}
