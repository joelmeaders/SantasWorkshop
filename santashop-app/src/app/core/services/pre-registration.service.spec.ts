import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import type { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
	BehaviorSubject,
	type Observable,
	Subject,
	Subscription,
	throwError,
} from 'rxjs';
import {
	AnalyticsWrapper,
	AuthService,
	FireRepoLite,
	FunctionsWrapper,
	type IFireRepoCollection,
} from '@santashop/core';
import { ToyType, type Child, type Registration } from '@santashop/models';
import { PreRegistrationService } from './pre-registration.service';
import { QrCodeService } from './qrcode.service';

const child = (): Child => ({
	id: 7,
	firstName: 'Taylor',
	lastName: 'Smith',
	dateOfBirth: new Date('2017-03-04T00:00:00.000Z'),
	toyType: ToyType.boy,
	enabled: true,
});
const registration = (uid = 'first'): Registration => ({
	uid,
	qrCodeStoragePath: `registrations/${uid}/ticket.png`,
	children: [child()],
	dateTimeSlot: {
		id: 'slot-1',
		dateTime: new Date('2026-12-12T18:00:00.000Z'),
	},
	registrationSubmittedOn: new Date('2026-11-01T12:00:00.000Z'),
});
// Only identity is read by this service; other Firebase User SDK members are outside this fixture.
const identity = (uid: string): FirebaseUser => ({ uid }) as FirebaseUser;
const callableFixtures = (): Pick<
	FunctionsWrapper,
	| 'saveDraftChild'
	| 'deleteDraftChild'
	| 'setDraftAppointment'
	| 'completeRegistration'
	| 'undoRegistration'
	| 'changeRegistrationDateTime'
> => ({
	saveDraftChild: vi
		.fn<FunctionsWrapper['saveDraftChild']>()
		.mockResolvedValue({ data: true }),
	deleteDraftChild: vi
		.fn<FunctionsWrapper['deleteDraftChild']>()
		.mockResolvedValue({ data: true }),
	setDraftAppointment: vi
		.fn<FunctionsWrapper['setDraftAppointment']>()
		.mockResolvedValue({ data: true }),
	completeRegistration: vi
		.fn<FunctionsWrapper['completeRegistration']>()
		.mockResolvedValue({ data: true }),
	undoRegistration: vi
		.fn<FunctionsWrapper['undoRegistration']>()
		.mockResolvedValue({ data: true }),
	changeRegistrationDateTime: vi
		.fn<FunctionsWrapper['changeRegistrationDateTime']>()
		.mockResolvedValue({ data: true }),
});

describe('PreRegistrationService', () => {
	let service: PreRegistrationService;
	let auth: BehaviorSubject<FirebaseUser | null>;
	let snapshot: Subject<Registration | undefined>;
	let read: ReturnType<
		typeof vi.fn<IFireRepoCollection<Registration>['read']>
	>;
	let getQr: ReturnType<typeof vi.fn<QrCodeService['registrationQrCodeUrl']>>;
	let log: ReturnType<typeof vi.fn<AnalyticsWrapper['logEventWithParams']>>;
	let present: ReturnType<typeof vi.fn>;
	let createAlert: ReturnType<typeof vi.fn>;
	let functions: ReturnType<typeof callableFixtures>;
	let subscriptions: Subscription;
	const observe = <T>(source: Observable<T>): T[] => {
		const values: T[] = [];
		subscriptions.add(source.subscribe((value) => values.push(value)));
		return values;
	};

	beforeEach(() => {
		subscriptions = new Subscription();
		auth = new BehaviorSubject<FirebaseUser | null>(null);
		snapshot = new Subject<Registration | undefined>();
		read = vi
			.fn<IFireRepoCollection<Registration>['read']>()
			.mockReturnValue(snapshot);
		getQr = vi
			.fn<QrCodeService['registrationQrCodeUrl']>()
			.mockResolvedValue('ticket-url');
		log = vi.fn<AnalyticsWrapper['logEventWithParams']>();
		present = vi.fn().mockResolvedValue(undefined);
		createAlert = vi.fn().mockResolvedValue({ present });
		functions = callableFixtures();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: AuthService,
					useValue: { currentUser$: auth } satisfies Pick<
						AuthService,
						'currentUser$'
					>,
				},
				{
					provide: FireRepoLite,
					useValue: {
						collection: (): Pick<
							IFireRepoCollection<Registration>,
							'read'
						> => ({ read }),
					},
				},
				{
					provide: QrCodeService,
					useValue: { registrationQrCodeUrl: getQr } satisfies Pick<
						QrCodeService,
						'registrationQrCodeUrl'
					>,
				},
				{
					provide: AnalyticsWrapper,
					useValue: { logEventWithParams: log } satisfies Pick<
						AnalyticsWrapper,
						'logEventWithParams'
					>,
				},
				{ provide: AlertController, useValue: { create: createAlert } },
				{ provide: FunctionsWrapper, useValue: functions },
			],
		});
		service = TestBed.inject(PreRegistrationService);
	});
	afterEach(() => subscriptions.unsubscribe());

	it('waits for an authenticated read before deciding completion', () => {
		auth.next(identity('first'));
		const completed = observe(service.registrationComplete$);
		const visible = observe(service.userRegistration$);
		expect(completed).toEqual([]);
		expect(visible.at(-1)).toBeUndefined();
		expect(read).toHaveBeenCalledOnce();
		expect(read).toHaveBeenCalledWith('first', 'uid');
		snapshot.next(registration());
		expect(completed).toEqual([true]);
		expect(visible.at(-1)?.uid).toBe('first');
	});

	it('clears old identity data, cancels its listener, and waits for the next registration', () => {
		const visible = observe(service.userRegistration$);
		const completed = observe(service.registrationComplete$);
		auth.next(identity('first'));
		snapshot.next(registration());
		const nextSnapshot = new Subject<Registration | undefined>();
		read.mockReturnValue(nextSnapshot);
		const completionCount = completed.length;
		auth.next(identity('second'));
		expect(snapshot.observed).toBe(false);
		expect(visible.at(-1)).toBeUndefined();
		expect(completed).toHaveLength(completionCount);
		snapshot.next(registration('stale'));
		nextSnapshot.next(registration('second'));
		expect(visible.at(-1)?.uid).toBe('second');
		auth.next(null);
		expect(nextSnapshot.observed).toBe(false);
		expect(visible.at(-1)).toBeUndefined();
		expect(completed.at(-1)).toBe(false);
		expect(log).not.toHaveBeenCalled();
	});

	it('normalizes a shared read without changing stored objects', () => {
		const stored = registration();
		const timestamp = Timestamp.fromDate(child().dateOfBirth);
		stored.children = [
			{ ...child(), dateOfBirth: timestamp as unknown as Date },
		];
		stored.dateTimeSlot = {
			id: 'slot-1',
			dateTime: timestamp as unknown as Date,
		};
		const visible = observe(service.userRegistration$);
		const children = observe(service.children$);
		auth.next(identity('first'));
		snapshot.next(stored);
		expect(visible.at(-1)).not.toBe(stored);
		expect(children.at(-1)?.[0].dateOfBirth).toEqual(timestamp.toDate());
		expect(visible.at(-1)?.dateTimeSlot?.dateTime).toEqual(
			timestamp.toDate(),
		);
		expect(stored.children[0].dateOfBirth).toBe(timestamp);
		expect(stored.dateTimeSlot.dateTime).toBe(timestamp);
		expect(read).toHaveBeenCalledOnce();
	});

	it('derives draft, child-error, submitted, and checked-in state from successive snapshots', () => {
		const complete = observe(service.registrationComplete$);
		const submitted = observe(service.registrationSubmitted$);
		const checkedIn = observe(service.hasCheckedIn$);
		const counts = observe(service.childCount$);
		const valid = observe(service.noErrorsInChildren$);
		const slots = observe(service.dateTimeSlot$);
		auth.next(identity('first'));
		snapshot.next(registration());
		expect([
			complete.at(-1),
			submitted.at(-1),
			checkedIn.at(-1),
			counts.at(-1),
			valid.at(-1),
		]).toEqual([true, true, false, 1, true]);
		expect(slots.at(-1)?.id).toBe('slot-1');
		const draft = {
			...registration(),
			registrationSubmittedOn: undefined,
			children: [{ ...child(), error: 'invalid_age' }],
		};
		snapshot.next(draft);
		expect([complete.at(-1), submitted.at(-1), valid.at(-1)]).toEqual([
			false,
			false,
			false,
		]);
		expect(service.isRegistrationReadyToSubmit(draft)).toBe(true);
		snapshot.next({ ...registration(), hasCheckedIn: true });
		expect(checkedIn.at(-1)).toBe(true);
		snapshot.next({
			...registration(),
			children: undefined,
			dateTimeSlot: undefined,
		});
		expect([
			complete.at(-1),
			counts.at(-1),
			valid.at(-1),
			slots.at(-1),
		]).toEqual([false, 0, true, undefined]);
		expect(service.isRegistrationReadyToSubmit(registration())).toBe(false);
	});

	it('reports a missing record once per identity and not for signed-out/loading state', async () => {
		observe(service.userRegistration$);
		expect(createAlert).not.toHaveBeenCalled();
		auth.next(identity('first'));
		expect(createAlert).not.toHaveBeenCalled();
		snapshot.next(undefined);
		snapshot.next(undefined);
		await Promise.resolve();
		expect(log).toHaveBeenCalledExactlyOnceWith(
			'registration_record_unavailable',
			{ reason: 'missing' },
		);
		expect(present).toHaveBeenCalledOnce();
		auth.next(null);
		auth.next(identity('second'));
		snapshot.next(undefined);
		expect(createAlert).toHaveBeenCalledTimes(2);
	});

	it('recovers a failed read for a subsequent identity', () => {
		read.mockReturnValueOnce(
			throwError(() => new Error('unreadable')),
		).mockReturnValue(snapshot);
		const visible = observe(service.userRegistration$);
		auth.next(identity('first'));
		expect(log).toHaveBeenCalledWith('registration_record_unavailable', {
			reason: 'unreadable',
		});
		expect(visible.at(-1)).toBeUndefined();
		auth.next(identity('second'));
		snapshot.next(registration('second'));
		expect(visible.at(-1)?.uid).toBe('second');
	});

	it('releases listeners on last unsubscribe and on service destruction', () => {
		observe(service.children$);
		observe(service.registrationComplete$);
		auth.next(identity('first'));
		subscriptions.unsubscribe();
		expect(snapshot.observed).toBe(false);
		subscriptions = new Subscription();
		observe(service.children$);
		expect(read).toHaveBeenCalledTimes(2);
		expect(snapshot.observed).toBe(true);
		TestBed.resetTestingModule();
		expect(snapshot.observed).toBe(false);
	});

	it('shares QR downloads and ignores a late result after sign-out', async () => {
		let resolveQr!: (url: string) => void;
		getQr.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveQr = resolve;
				}),
		);
		const urls = observe(service.qrCode$);
		observe(service.qrCode$);
		auth.next(identity('first'));
		snapshot.next(registration());
		snapshot.next(registration());
		expect(getQr).toHaveBeenCalledExactlyOnceWith(
			'registrations/first/ticket.png',
		);
		auth.next(null);
		resolveQr('old-ticket');
		await Promise.resolve();
		expect(urls.at(-1)).toBeUndefined();
		expect(urls).not.toContain('old-ticket');
		auth.next(identity('second'));
		snapshot.next(registration('second'));
		await vi.waitFor(() => expect(urls.at(-1)).toBe('ticket-url'));
	});

	it('does not download a QR image without a path', () => {
		observe(service.qrCode$);
		auth.next(identity('first'));
		snapshot.next({ ...registration(), qrCodeStoragePath: '' });
		expect(getQr).not.toHaveBeenCalled();
	});

	it('forwards mutation identities and serializes calendar dates at the callable boundary', async () => {
		await service.saveDraftChild({
			mutationId: 'save-0001',
			child: child(),
		});
		await service.deleteDraftChild({
			mutationId: 'delete-0001',
			childId: 7,
		});
		await service.setDraftAppointment({
			mutationId: 'slot-0001',
			slotId: 'slot-1',
		});
		await service.completeRegistration({ mutationId: 'submit-0001' });
		await service.undoRegistration();
		await service.changeRegistrationDateTime({
			id: 'slot-2',
			dateTime: new Date(),
			programYear: 2026,
			maxSlots: 10,
			enabled: true,
		});
		expect(functions.saveDraftChild).toHaveBeenCalledWith({
			mutationId: 'save-0001',
			child: {
				id: 7,
				firstName: 'Taylor',
				lastName: 'Smith',
				dateOfBirth: '2017-03-04',
				toyType: ToyType.boy,
			},
		});
		expect(functions.deleteDraftChild).toHaveBeenCalledWith({
			mutationId: 'delete-0001',
			childId: 7,
		});
		expect(functions.setDraftAppointment).toHaveBeenCalledWith({
			mutationId: 'slot-0001',
			slotId: 'slot-1',
		});
		expect(functions.completeRegistration).toHaveBeenCalledWith({
			mutationId: 'submit-0001',
		});
		expect(functions.undoRegistration).toHaveBeenCalledWith({
			mutationId: expect.any(String),
		});
		expect(functions.changeRegistrationDateTime).toHaveBeenCalledWith({
			mutationId: expect.any(String),
			slotId: 'slot-2',
		});
		await expect(
			service.saveDraftChild({
				mutationId: 'bad-child',
				child: { ...child(), id: undefined },
			}),
		).rejects.toThrow('Child ID is required.');
		await expect(
			service.changeRegistrationDateTime({
				dateTime: new Date(),
				programYear: 2026,
				enabled: true,
				maxSlots: 10,
			}),
		).rejects.toThrow('Appointment ID is required.');
	});
});
