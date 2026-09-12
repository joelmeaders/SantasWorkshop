import { provideAdminLanguage } from '../../santashop-admin/src/app/shared/preferences/admin-language.providers';
import {
	type DebugElement,
	type EnvironmentProviders,
	getDebugNode,
	InjectionToken,
	inject,
	type Provider,
} from '@angular/core';
import {
	ActivatedRoute,
	convertToParamMap,
	provideRouter,
	withHashLocation,
} from '@angular/router';
import {
	AlertController,
	LoadingController,
	ModalController,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import {
	AnalyticsWrapper,
	AppStateService,
	AuthService,
	FireRepoLite,
	FunctionsWrapper,
	PROGRAM_YEAR,
	SHOP_DAYS,
} from '@santashop/core/admin/firestore';
import {
	AgeGroup,
	COLLECTION_SCHEMA,
	ToyType,
	type CheckIn,
	type CheckInAggregatedStats,
	type DateTimeSlot,
	type EmailTemplateDetail,
	type EmailTemplateRevision,
	type EmailTemplateSummary,
	type OwnerOperation,
	type PreviewOwnerOperationResponse,
	type Registration,
	type RegistrationScanAttempt,
	type RegistrationScanRiskSummary,
	type RegistrationSearchIndex,
	type RegistrationStats,
	type ScheduleStats,
	type StaffAccount,
	type UserStats,
} from '@santashop/models';
import { applicationConfig, type Decorator } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { BehaviorSubject, map, of } from 'rxjs';
import { EmailTemplateService } from '../../santashop-admin/src/app/pages/admin/tools/email-templates/email-template.service';
import { LandingPage } from '../../santashop-admin/src/app/pages/admin/landing/landing.page';
import { OwnerOperationsService } from '../../santashop-admin/src/app/pages/admin/tools/owner-operations/owner-operations.service';
import { StaffService } from '../../santashop-admin/src/app/pages/admin/users/staff.service';
import { DateTimeModalService } from '../../santashop-admin/src/app/shared/components/date-time-modal/date-time-modal.service';
import { AdminReadRepository } from '../../santashop-admin/src/app/shared/services/admin-read-repository.service';
import { CheckInContextService } from '../../santashop-admin/src/app/shared/services/check-in-context.service';
import { CheckInService } from '../../santashop-admin/src/app/shared/services/check-in.service';
import { LookupService } from '../../santashop-admin/src/app/shared/services/lookup.service';
import { RegistrationScanService } from '../../santashop-admin/src/app/shared/services/registration-scan.service';
import { ScanRiskService } from '../../santashop-admin/src/app/shared/services/scan-risk.service';
import { SearchService } from '../../santashop-admin/src/app/pages/admin/search/search.service';

const programYear = 2026;
const firstEventDate = new Date('2026-12-12T17:00:00.000Z');
const secondEventDate = new Date('2026-12-12T18:00:00.000Z');

export const demoChildren = [
	{
		id: 101,
		firstName: 'Ava',
		lastName: 'Rivera',
		dateOfBirth: new Date('2018-04-12T00:00:00.000Z'),
		ageGroup: AgeGroup.age68,
		toyType: ToyType.girl,
		programYearAdded: programYear,
		enabled: true,
	},
	{
		id: 102,
		firstName: 'Mateo',
		lastName: 'Rivera',
		dateOfBirth: new Date('2022-08-03T00:00:00.000Z'),
		ageGroup: AgeGroup.age35,
		toyType: ToyType.boy,
		programYearAdded: programYear,
		enabled: true,
	},
];

export const demoSlots: DateTimeSlot[] = [
	{
		id: 'slot-2026-12-12-10',
		programYear,
		dateTime: firstEventDate,
		maxSlots: 40,
		slotsReserved: 27,
		enabled: true,
	},
	{
		id: 'slot-2026-12-12-11',
		programYear,
		dateTime: secondEventDate,
		maxSlots: 30,
		slotsReserved: 30,
		enabled: true,
	},
];

export const demoRegistration: Registration = {
	uid: 'customer-1001',
	qrcode: 'SW26A101',
	qrCodeStoragePath: 'qrcodes/customer-1001.png',
	firstName: 'Elena',
	lastName: 'Rivera',
	emailAddress: 'elena.rivera@example.test',
	programYear,
	children: demoChildren,
	dateTimeSlot: demoSlots[0],
	zipCode: '80204',
	referredBy: 'Denver Human Services DHS',
	preferredLanguage: 'en',
	newsletter: true,
};

export const demoSearchResults: RegistrationSearchIndex[] = [
	{
		firstName: 'Elena',
		lastName: 'Rivera',
		displayFirstName: 'Elena',
		displayLastName: 'Rivera',
		emailAddress: 'elena.rivera@example.test',
		customerId: 'customer-1001',
		zip: '80204',
		code: 'SW26A101',
	},
	{
		firstName: 'Jordan',
		lastName: 'Nguyen',
		emailAddress: 'jordan.nguyen@example.test',
		customerId: 'customer-1002',
		zip: '80211',
		code: 'SW26B202',
	},
];

export const demoStaffAccounts: StaffAccount[] = [
	{
		uid: 'staff-admin',
		displayName: 'Morgan Admin',
		emailAddress: 'morgan.admin@example.test',
		roles: ['admin'],
		disabled: false,
		createdOn: new Date('2026-01-10T18:00:00.000Z'),
		updatedOn: new Date('2026-08-14T18:00:00.000Z'),
	},
	{
		uid: 'staff-checkin',
		displayName: 'Casey Check-In',
		emailAddress: 'casey.checkin@example.test',
		roles: ['checkin'],
		disabled: false,
		createdOn: new Date('2026-02-05T18:00:00.000Z'),
		updatedOn: new Date('2026-07-03T18:00:00.000Z'),
	},
];

export const demoRiskAttempts: RegistrationScanAttempt[] = [
	{
		id: 'attempt-1',
		customerId: 'customer-1001',
		scannerUid: 'staff-checkin',
		scannedOn: new Date('2026-12-12T18:26:00.000Z'),
		programYear,
		outcome: 'duplicate-risk',
		priorEventOn: new Date('2026-12-12T18:01:00.000Z'),
		elapsedSeconds: 1500,
		inputMethod: 'camera',
		codeFingerprint: 'sample-fingerprint',
		codeSuffix: 'A101',
	},
];

export const demoRiskSummaries: RegistrationScanRiskSummary[] = [
	{
		customerId: 'customer-1001',
		programYear,
		firstName: 'Elena',
		lastName: 'Rivera',
		emailAddress: 'elena.rivera@example.test',
		accidentalAttemptCount: 1,
		lateDuplicateAttemptCount: 2,
		cancelledCodeAttemptCount: 0,
		totalRiskAttemptCount: 2,
		firstRiskOn: new Date('2026-12-12T18:20:00.000Z'),
		latestRiskOn: new Date('2026-12-12T18:26:00.000Z'),
		latestOutcome: 'duplicate-risk',
		originalCheckInOn: new Date('2026-12-12T18:01:00.000Z'),
	},
];

const emailRevision: EmailTemplateRevision = {
	id: 'revision-3',
	templateKey: 'event-reminder-2026-en',
	deliveryProfile: 'event-reminder',
	language: 'en',
	revisionNumber: 3,
	subjectPart: 'Your Santa Shop visit is coming up',
	textPart: 'Hello {{firstName}}, your visit is on {{dateTime}}.',
	htmlStoragePath: 'email-templates/event-reminder/revision-3.html',
	htmlFileName: 'event-reminder-2026-en.html',
	fieldMappings: [
		{
			name: 'firstName',
			mapping: 'firstName',
			sampleValue: 'Elena',
			description: 'Customer first name',
		},
		{
			name: 'dateTime',
			mapping: 'dateTime',
			sampleValue: 'Saturday, December 12 at 10:00 AM',
		},
	],
	createdOn: new Date('2026-08-21T18:00:00.000Z'),
	createdByEmail: 'morgan.admin@example.test',
	publishedOn: new Date('2026-08-22T18:00:00.000Z'),
};

export const demoEmailTemplate: EmailTemplateSummary = {
	key: 'event-reminder-2026-en',
	deliveryProfile: 'event-reminder',
	language: 'en',
	displayName: '2026 Event Reminder (English)',
	description: 'Sent before the family appointment.',
	subjectPart: emailRevision.subjectPart,
	textPart: emailRevision.textPart,
	awsTemplateName: 'SantaShopEventReminder2026En',
	fieldMappings: emailRevision.fieldMappings,
	currentRevisionId: emailRevision.id,
	currentRevisionNumber: emailRevision.revisionNumber,
	publishedRevisionId: emailRevision.id,
	publishedRevisionNumber: emailRevision.revisionNumber,
	publishedOn: emailRevision.publishedOn,
	seasonalReviewRequired: true,
	seasonalDetailsReviewed: true,
	createdOn: new Date('2026-07-01T18:00:00.000Z'),
	updatedOn: new Date('2026-08-22T18:00:00.000Z'),
};

const demoEmailDetail: EmailTemplateDetail = {
	template: demoEmailTemplate,
	revisions: [emailRevision],
	currentHtml:
		'<h1>Hello {{firstName}}</h1><p>Your visit is {{dateTime}}.</p>',
};

const demoCheckInStats: CheckInAggregatedStats = {
	lastUpdated: new Date('2026-12-12T22:00:00.000Z'),
	dateTimeCount: [
		{
			dateKey: '2026-12-12',
			date: 12,
			hour: 10,
			customerCount: 18,
			childCount: 37,
			pregisteredCount: 15,
			modifiedCount: 5,
		},
		{
			dateKey: '2026-12-12',
			date: 12,
			hour: 11,
			customerCount: 22,
			childCount: 43,
			pregisteredCount: 17,
			modifiedCount: 7,
		},
	],
};

const blankBreakdown = {
	total: 0,
	age02: 0,
	age35: 0,
	age68: 0,
	age911: 0,
};

const demoRegistrationStats: RegistrationStats = {
	completedRegistrations: 64,
	dateTimeCount: [
		{
			dateTime: firstEventDate,
			count: 27,
			childCount: 51,
			stats: {
				infants: { ...blankBreakdown, total: 5, age02: 5 },
				girls: {
					...blankBreakdown,
					total: 25,
					age35: 7,
					age68: 11,
					age911: 7,
				},
				boys: {
					...blankBreakdown,
					total: 21,
					age35: 6,
					age68: 9,
					age911: 6,
				},
			},
		},
	],
	zipCodeCount: [
		{ zip: 80204, count: 19, childCount: 38 },
		{ zip: 80211, count: 14, childCount: 27 },
	],
};

const demoScheduleStats: ScheduleStats = {
	dateTimeCounts: [
		{ dateTime: firstEventDate, count: 27 },
		{ dateTime: secondEventDate, count: 30 },
	],
};

const demoUserStats: UserStats = {
	totalUsers: 116,
	zipCodeCount: [
		{ zip: '80204', count: 31 },
		{ zip: '80211', count: 24 },
	],
	referrerCount: [
		{ referrer: 'Denver Human Services DHS', count: 28 },
		{ referrer: 'School - Denver Public Schools (DPS)', count: 21 },
	],
};

const demoCheckIn: CheckIn = {
	customerId: 'customer-1001',
	registrationCode: 'SW26A101',
	checkInDateTime: new Date('2026-12-12T18:01:00.000Z'),
	inStats: true,
	stats: {
		preregistered: true,
		children: 2,
		ageGroup02: 0,
		ageGroup35: 1,
		ageGroup68: 1,
		ageGroup911: 0,
		toyTypeInfant: 0,
		toyTypeBoy: 1,
		toyTypeGirl: 1,
		zipCode: '80204',
		modifiedAtCheckIn: false,
	},
};

const previewOperation: PreviewOwnerOperationResponse = {
	previewId: 'preview-story',
	operation: 'queue-reminder-emails',
	projectId: 'santas-workshop-story',
	programYear,
	expiresAt: '2026-09-06T20:00:00.000Z',
	confirmationPhrase: 'QUEUE 42 REMINDERS',
	counts: { eligibleRegistrations: 42, skippedRegistrations: 3 },
	seasonRestricted: true,
};

const completedOperation: OwnerOperation = {
	id: 'operation-story',
	operation: 'queue-reminder-emails',
	status: 'succeeded',
	projectId: 'santas-workshop-story',
	programYear,
	actorUid: 'staff-owner',
	counts: previewOperation.counts,
	progress: { completed: 42 },
	result: { message: 'Queued 42 reminder emails.' },
	createdAt: '2026-09-06T19:00:00.000Z',
	updatedAt: '2026-09-06T19:01:00.000Z',
	completedAt: '2026-09-06T19:01:00.000Z',
};

export interface AdminStoryOptions {
	readonly featureEnabled?: boolean;
	readonly isAdmin?: boolean;
	readonly isOwner?: boolean;
	readonly registration?: Registration | null;
	readonly checkIn?: { readonly code: string; readonly count: number } | null;
	readonly searchResults?: readonly RegistrationSearchIndex[] | null;
	readonly staffAccounts?: readonly StaffAccount[];
	readonly slots?: readonly DateTimeSlot[];
	readonly riskSummaries?: readonly RegistrationScanRiskSummary[];
	readonly riskAttempts?: readonly RegistrationScanAttempt[];
	readonly routeParams?: Readonly<Record<string, string>>;
	readonly emailTemplates?: readonly EmailTemplateSummary[];
	readonly emptyStats?: boolean;
}

export interface AdminStoryFixtures {
	readonly featureEnabled$: BehaviorSubject<boolean>;
	readonly isAdmin$: BehaviorSubject<boolean>;
	readonly isOwner$: BehaviorSubject<boolean>;
	readonly registration$: BehaviorSubject<Registration | undefined>;
	readonly checkInReceipt$: BehaviorSubject<
		{ readonly code: string; readonly count: number } | undefined
	>;
	readonly searchResults$: BehaviorSubject<RegistrationSearchIndex[] | null>;
	readonly staffAccounts$: BehaviorSubject<StaffAccount[]>;
	readonly slots$: BehaviorSubject<DateTimeSlot[]>;
	readonly riskSummaries$: BehaviorSubject<RegistrationScanRiskSummary[]>;
	readonly riskAttempts$: BehaviorSubject<RegistrationScanAttempt[]>;
	readonly checkInStats$: BehaviorSubject<CheckInAggregatedStats | undefined>;
	readonly registrationStats$: BehaviorSubject<RegistrationStats | undefined>;
	readonly scheduleStats$: BehaviorSubject<ScheduleStats | undefined>;
	readonly userStats$: BehaviorSubject<UserStats | undefined>;
	readonly modalDismissed: unknown[];
}

export const ADMIN_STORY_FIXTURES = new InjectionToken<AdminStoryFixtures>(
	'ADMIN_STORY_FIXTURES',
);

const createOverlay = (): object => ({
	present: fn(async (): Promise<void> => undefined),
	dismiss: fn(async (): Promise<boolean> => true),
	onDidDismiss: fn(async () => ({ role: 'cancel', data: null })),
});

const cloneStoryData = <T>(value: T): T => structuredClone(value);

const createAdminReadRepository = (fixtures: AdminStoryFixtures): object => ({
	collection: fn((path: string) => ({
		read: fn((id: string) => {
			if (id.startsWith('checkin-'))
				return fixtures.checkInStats$.asObservable();
			if (id.startsWith('registration-'))
				return of(cloneStoryData(fixtures.registrationStats$.value));
			if (id.startsWith('schedule-'))
				return of(cloneStoryData(fixtures.scheduleStats$.value));
			if (id.startsWith('user-'))
				return of(cloneStoryData(fixtures.userStats$.value));
			if (path === COLLECTION_SCHEMA.checkins)
				return of(cloneStoryData(demoCheckIn));
			return of(undefined);
		}),
		readMany: fn(() => {
			if (path === COLLECTION_SCHEMA.dateTimeSlots)
				return of(cloneStoryData(fixtures.slots$.value));
			return of([]);
		}),
	})),
});

const createAdminStoryFixtures = (
	options: AdminStoryOptions,
): AdminStoryFixtures => {
	const registration =
		options.registration === undefined
			? demoRegistration
			: (options.registration ?? undefined);
	const checkIn =
		options.checkIn === undefined
			? { code: 'SW26A101', count: 2 }
			: (options.checkIn ?? undefined);
	const searchResults =
		options.searchResults === undefined
			? demoSearchResults
			: options.searchResults;

	return {
		featureEnabled$: new BehaviorSubject(options.featureEnabled ?? true),
		isAdmin$: new BehaviorSubject(options.isAdmin ?? true),
		isOwner$: new BehaviorSubject(options.isOwner ?? true),
		registration$: new BehaviorSubject(
			registration ? cloneStoryData(registration) : undefined,
		),
		checkInReceipt$: new BehaviorSubject(
			checkIn ? cloneStoryData(checkIn) : undefined,
		),
		searchResults$: new BehaviorSubject(
			searchResults === null
				? null
				: cloneStoryData([...(searchResults ?? [])]),
		),
		staffAccounts$: new BehaviorSubject(
			cloneStoryData([...(options.staffAccounts ?? demoStaffAccounts)]),
		),
		slots$: new BehaviorSubject(
			cloneStoryData(
				options.emptyStats ? [] : [...(options.slots ?? demoSlots)],
			),
		),
		riskSummaries$: new BehaviorSubject(
			cloneStoryData([...(options.riskSummaries ?? demoRiskSummaries)]),
		),
		riskAttempts$: new BehaviorSubject(
			cloneStoryData([...(options.riskAttempts ?? demoRiskAttempts)]),
		),
		checkInStats$: new BehaviorSubject(
			options.emptyStats ? undefined : cloneStoryData(demoCheckInStats),
		),
		registrationStats$: new BehaviorSubject(
			options.emptyStats
				? undefined
				: cloneStoryData(demoRegistrationStats),
		),
		scheduleStats$: new BehaviorSubject(
			options.emptyStats ? undefined : cloneStoryData(demoScheduleStats),
		),
		userStats$: new BehaviorSubject(
			options.emptyStats ? undefined : cloneStoryData(demoUserStats),
		),
		modalDismissed: [],
	};
};

const createSearchService = (
	fixtures: AdminStoryFixtures,
): Pick<
	SearchService,
	| 'state$'
	| 'searchByLastNameZip'
	| 'searchByEmail'
	| 'searchByCode'
	| 'searchUsersByEmailAddress'
	| 'refresh'
	| 'reset'
> => ({
	state$: fixtures.searchResults$.pipe(
		map((results) =>
			results === null
				? { status: 'idle' as const }
				: {
						status: 'ready' as const,
						results: cloneStoryData(results),
					},
		),
	),
	searchByLastNameZip: fn(),
	searchByEmail: fn(),
	searchByCode: fn(),
	searchUsersByEmailAddress: fn(() => of([])),
	refresh: fn(),
	reset: fn(() => fixtures.searchResults$.next(null)),
});

const createProviders = (
	options: AdminStoryOptions,
): (Provider | EnvironmentProviders)[] => {
	const routeParams = options.routeParams ?? {
		uid: 'customer-1001',
		qrcode: 'SW26A101',
		key: demoEmailTemplate.key,
	};
	const paramMap = convertToParamMap(routeParams);
	const blockedScan = {
		disposition: 'duplicate-risk' as const,
		registration: demoRegistration,
		attempt: demoRiskAttempts[0],
		priorCheckIn: demoCheckIn,
	};
	return [
		{
			provide: ADMIN_STORY_FIXTURES,
			useFactory: () => createAdminStoryFixtures(options),
		},
		provideIonicAngular({ mode: 'md', animated: false }),
		provideRouter(
			[
				{ path: '', pathMatch: 'full', redirectTo: 'admin/landing' },
				{
					path: 'admin',
					children: [
						{ path: 'landing', component: LandingPage },
						{ path: '**', component: LandingPage },
					],
				},
			],
			withHashLocation(),
		),
		{ provide: PROGRAM_YEAR, useValue: programYear },
		{ provide: SHOP_DAYS, useValue: [12, 13, 19, 20] },
		{
			provide: ActivatedRoute,
			useFactory: () => ({
				snapshot: { params: routeParams, paramMap },
				paramMap: of(paramMap),
				params: of(routeParams),
				queryParams: of({}),
				data: of({}),
			}),
		},
		{
			provide: AuthService,
			useFactory: (): object => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					currentUser$: of({
						uid: 'staff-owner',
						email: 'owner@example.test',
					}),
					isAdmin$: fixtures.isAdmin$.asObservable(),
					isOwner$: fixtures.isOwner$.asObservable(),
					isCheckin$: of(true),
					roles$: of(['admin']),
					login: fn(async (): Promise<object> => ({})),
					logout: fn(async (): Promise<void> => undefined),
					reauthenticate: fn(async (): Promise<void> => undefined),
					getCurrentUserToken: fn(async () => ({
						claims: { owner: true },
					})),
				};
			},
		},
		{
			provide: AppStateService,
			useFactory: (): Pick<
				AppStateService,
				| 'prefersDark'
				| 'preRegistrationEnabled$'
				| 'onsiteRegistrationEnabled$'
				| 'checkinEnabled$'
				| 'allowCancelRegistration$'
				| 'allowChangeRegistration$'
			> => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					prefersDark: false,
					preRegistrationEnabled$:
						fixtures.featureEnabled$.asObservable(),
					onsiteRegistrationEnabled$:
						fixtures.featureEnabled$.asObservable(),
					checkinEnabled$: fixtures.featureEnabled$.asObservable(),
					allowCancelRegistration$: of(true),
					allowChangeRegistration$: of(true),
				};
			},
		},
		{
			provide: AnalyticsWrapper,
			useFactory: () => ({ logEventWithParams: fn() }),
		},
		{
			provide: AlertController,
			useFactory: () => ({
				create: fn(async () => createOverlay()),
				getTop: fn(async () => undefined),
			}),
		},
		{
			provide: ModalController,
			useFactory: (): object => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					create: fn(async () => createOverlay()),
					dismiss: fn(async (value?: unknown): Promise<boolean> => {
						fixtures.modalDismissed.push(value);
						return true;
					}),
					getTop: fn(async () => undefined),
				};
			},
		},
		{
			provide: LoadingController,
			useFactory: () => ({
				create: fn(async () => createOverlay()),
				dismiss: fn(async (): Promise<boolean> => true),
				getTop: fn(async () => undefined),
			}),
		},
		{
			provide: FunctionsWrapper,
			useFactory: () => ({
				callableWrapper: fn(() => fn(async () => ({ data: 2 }))),
			}),
		},
		{
			provide: FireRepoLite,
			useFactory: (): object => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					collection: fn((path: string) => ({
						read: fn(() => of(undefined)),
						readMany: fn(() =>
							path === COLLECTION_SCHEMA.dateTimeSlots
								? of(cloneStoryData(fixtures.slots$.value))
								: of([]),
						),
						add: fn(() => of({})),
						addById: fn(() => of({})),
						update: fn(() => of({})),
						delete: fn(() => of(undefined)),
					})),
					randomId: fn(() => 'story-random-id'),
				};
			},
		},
		{
			provide: AdminReadRepository,
			useFactory: () =>
				createAdminReadRepository(inject(ADMIN_STORY_FIXTURES)),
		},
		{
			provide: SearchService,
			useFactory: () => createSearchService(inject(ADMIN_STORY_FIXTURES)),
		},
		{
			provide: CheckInContextService,
			useFactory: (): Pick<
				CheckInContextService,
				| 'currentRegistration$'
				| 'checkin$'
				| 'blockedScan$'
				| 'inputMethod$'
				| 'setRegistration'
				| 'setCheckIn'
				| 'setBlockedScan'
				| 'resetRegistration'
				| 'reset'
			> => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					currentRegistration$: fixtures.registration$.asObservable(),
					checkin$: fixtures.checkInReceipt$.asObservable(),
					blockedScan$: of(cloneStoryData(blockedScan)),
					inputMethod$: of('manual'),
					setRegistration: fn((value: Registration | undefined) =>
						fixtures.registration$.next(
							value ? cloneStoryData(value) : undefined,
						),
					),
					setCheckIn: fn(),
					setBlockedScan: fn(),
					resetRegistration: fn(() =>
						fixtures.registration$.next(undefined),
					),
					reset: fn(),
				};
			},
		},
		{
			provide: CheckInService,
			useFactory: (): Pick<
				CheckInService,
				'checkIn' | 'onSiteRegistration'
			> => ({
				checkIn: fn(async (): Promise<number> => 2),
				onSiteRegistration: fn(async (): Promise<number> => 2),
			}),
		},
		{
			provide: RegistrationScanService,
			useFactory: (): Pick<RegistrationScanService, 'resolve'> => ({
				resolve: fn(async () => ({
					disposition: 'eligible' as const,
					registration: cloneStoryData(demoRegistration),
				})),
			}),
		},
		{
			provide: LookupService,
			useFactory: (): Pick<
				LookupService,
				'getRegistrationByQrCode$' | 'getSearchIndexByEmailAddress$'
			> => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					getRegistrationByQrCode$: fn(() =>
						fixtures.registration$.asObservable(),
					),
					getSearchIndexByEmailAddress$: fn(() =>
						of(cloneStoryData(demoSearchResults[0])),
					),
				};
			},
		},
		{
			provide: DateTimeModalService,
			useFactory: (): Pick<DateTimeModalService, 'availableSlots$'> => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					availableSlots$: fixtures.slots$.asObservable(),
				};
			},
		},
		{
			provide: ScanRiskService,
			useFactory: (): Pick<
				ScanRiskService,
				'summaries' | 'attempts' | 'checkIn'
			> => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					summaries: fn(() => fixtures.riskSummaries$.asObservable()),
					attempts: fn(() => fixtures.riskAttempts$.asObservable()),
					checkIn: fn(() => of(cloneStoryData(demoCheckIn))),
				};
			},
		},
		{
			provide: StaffService,
			useFactory: (): Pick<
				StaffService,
				| 'staffAccounts$'
				| 'state$'
				| 'refresh'
				| 'createStaffUser'
				| 'updateStaffUser'
				| 'deleteStaffUser'
			> => {
				const fixtures = inject(ADMIN_STORY_FIXTURES);
				return {
					staffAccounts$: fixtures.staffAccounts$.asObservable(),
					state$: fixtures.staffAccounts$.pipe(
						map((accounts) => ({
							status: 'ready' as const,
							accounts,
						})),
					),
					refresh: fn(),
					createStaffUser: fn(async () => 'staff-created'),
					updateStaffUser: fn(async (): Promise<void> => undefined),
					deleteStaffUser: fn(async (): Promise<void> => undefined),
				};
			},
		},
		{
			provide: EmailTemplateService,
			useFactory: (): Pick<
				EmailTemplateService,
				| 'listEmailTemplates'
				| 'getEmailTemplate'
				| 'getEmailTemplateRevision'
				| 'saveEmailTemplateRevision'
				| 'publishEmailTemplate'
				| 'sendTestEmailTemplate'
				| 'deleteEmailTemplate'
			> => ({
				listEmailTemplates: fn(async () =>
					cloneStoryData([
						...(options.emailTemplates ?? [demoEmailTemplate]),
					]),
				),
				getEmailTemplate: fn(async () =>
					cloneStoryData(demoEmailDetail),
				),
				getEmailTemplateRevision: fn(async () => ({
					template: cloneStoryData(demoEmailTemplate),
					revision: cloneStoryData(emailRevision),
					html: demoEmailDetail.currentHtml ?? '',
				})),
				saveEmailTemplateRevision: fn(async () => ({
					template: cloneStoryData(demoEmailTemplate),
					revision: cloneStoryData(emailRevision),
					html: demoEmailDetail.currentHtml ?? '',
				})),
				publishEmailTemplate: fn(async () => ({
					template: cloneStoryData(demoEmailTemplate),
					revision: cloneStoryData(emailRevision),
					renderedHtml: demoEmailDetail.currentHtml ?? '',
				})),
				sendTestEmailTemplate: fn(async () => ({
					recipientEmail: 'preview@example.test',
					renderedSubject: emailRevision.subjectPart,
					renderedHtml: demoEmailDetail.currentHtml ?? '',
				})),
				deleteEmailTemplate: fn(async (): Promise<void> => undefined),
			}),
		},
		{
			provide: OwnerOperationsService,
			useFactory: (): Pick<
				OwnerOperationsService,
				'preview' | 'start' | 'get' | 'getExportUrl'
			> => ({
				preview: fn(async () => cloneStoryData(previewOperation)),
				start: fn(async () => ({
					operationId: completedOperation.id,
					status: 'queued' as const,
				})),
				get: fn(async () => cloneStoryData(completedOperation)),
				getExportUrl: fn(async () => ({
					url: 'https://example.test/private-export.csv',
					expiresAt: '2026-09-06T20:00:00.000Z',
				})),
			}),
		},
	];
};

export const adminStoryDecorators = (
	options: AdminStoryOptions = {},
): Decorator[] => [
	applicationConfig({
		providers: [provideAdminLanguage(), ...createProviders(options)],
	}),
];

export const enterIonicStoryPage = async <
	T extends { ionViewWillEnter: () => unknown },
>(
	canvasElement: HTMLElement,
	selector: string,
): Promise<T> => {
	const host = canvasElement.querySelector(selector);
	if (!host) throw new Error(`Story did not render ${selector}.`);

	const debugElement = getDebugNode(host) as DebugElement | null;
	const instance = debugElement?.componentInstance as T | undefined;
	if (!instance) throw new Error(`Story could not inspect ${selector}.`);

	await instance.ionViewWillEnter();
	return instance;
};

export const getAdminStoryComponent = <T>(
	canvasElement: HTMLElement,
	selector: string,
): T => {
	const host = canvasElement.querySelector(selector);
	if (!host) throw new Error(`Story did not render ${selector}.`);

	const debugElement = getDebugNode(host) as DebugElement | null;
	const instance = debugElement?.componentInstance as T | undefined;
	if (!instance) throw new Error(`Story could not inspect ${selector}.`);

	return instance;
};

export const getAdminStoryFixtures = (
	canvasElement: HTMLElement,
): AdminStoryFixtures => {
	const elements = [
		canvasElement,
		...Array.from(canvasElement.querySelectorAll('*')),
	];
	for (const element of elements) {
		const debugElement = getDebugNode(element) as DebugElement | null;
		if (!debugElement) continue;
		try {
			return debugElement.injector.get(ADMIN_STORY_FIXTURES);
		} catch {
			continue;
		}
	}
	throw new Error('Story did not expose admin fixture subjects.');
};
