import {
	InjectionToken,
	inject,
	importProvidersFrom,
	provideAppInitializer,
	type EnvironmentProviders,
	type Provider,
} from '@angular/core';
import { provideLocationMocks } from '@angular/common/testing';
import {
	ActivatedRoute,
	convertToParamMap,
	provideRouter,
	type Routes,
	withEnabledBlockingInitialNavigation,
} from '@angular/router';
import {
	AlertController,
	LoadingController,
	ModalController,
	Platform,
	PopoverController,
	ToastController,
	provideIonicAngular,
} from '@ionic/angular/standalone';
import {
	TranslateLoader,
	TranslateModule,
	TranslateService,
	type TranslationObject,
} from '@ngx-translate/core';
import {
	AnalyticsWrapper,
	AppStateService,
	AuthService,
	ErrorHandlerService,
	FunctionsWrapper,
	PROGRAM_YEAR,
} from '@santashop/core/customer';
import { FireRepoLite } from '@santashop/core';
import type {
	Child,
	DateTimeSlot,
	Registration,
	User,
} from '@santashop/models';
import { applicationConfig } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { BehaviorSubject, firstValueFrom, map, Observable, of } from 'rxjs';
import enTranslations from '../../santashop-app/src/assets/i18n/en.json';
import esTranslations from '../../santashop-app/src/assets/i18n/es.json';
import { ApplicationService } from '../../santashop-app/src/app/core/services/application.service';
import { CustomerLanguageService } from '../../santashop-app/src/app/core/services/customer-language.service';
import { PreRegistrationService } from '../../santashop-app/src/app/core/services/pre-registration.service';
import { ProfilePageService } from '../../santashop-app/src/app/features/pre-registration/profile/profile.page.service';
import {
	changeEmailForm,
	changePasswordForm,
} from '../../santashop-app/src/app/features/pre-registration/profile/profile.form';
import { newChangeInfoForm } from '../../santashop-app/src/app/features/pre-registration/profile/change-info/change-info.form';

export interface CustomerStoryOptions {
	allowCancelRegistration?: boolean;
	allowChangeRegistration?: boolean;
	controls?: CustomerStoryControls | CustomerStoryControlsFactory;
	createAccountEnabled?: boolean | undefined;
	currentUser?: StoryUser | null;
	hasCheckedIn?: boolean;
	messageEn?: string;
	messageEs?: string;
	mode?: 'choose' | 'reset' | 'sign-in';
	popoverCreate?: OverlayCreate;
	registration?: Registration;
	routes?: Routes;
	slots?: DateTimeSlot[];
	userProfile?: User;
}

type OverlayCreate = (options?: object) => Promise<object>;

export interface StoryUser {
	displayName: string;
	email: string;
	uid: string;
}

export interface CustomerStoryControls {
	readonly currentUser$: BehaviorSubject<StoryUser | null>;
	readonly registration$: BehaviorSubject<Registration>;
	readonly registrationComplete$: BehaviorSubject<boolean>;
	readonly registrationSubmitted$: BehaviorSubject<boolean>;
	readonly hasCheckedIn$: BehaviorSubject<boolean>;
	readonly children$: BehaviorSubject<Child[]>;
	readonly childCount$: BehaviorSubject<number>;
	readonly noErrorsInChildren$: BehaviorSubject<boolean>;
	readonly dateTimeSlot$: BehaviorSubject<DateTimeSlot | undefined>;
	readonly qrCode$: BehaviorSubject<string>;
	readonly slots$: BehaviorSubject<DateTimeSlot[]>;
	readonly userProfile$: BehaviorSubject<User>;
	readonly allowCancelRegistration$: BehaviorSubject<boolean>;
	readonly allowChangeRegistration$: BehaviorSubject<boolean>;
	readonly createAccountEnabled$: BehaviorSubject<boolean | undefined>;
	readonly globalAlert$: BehaviorSubject<{ displayAlert: boolean }>;
	readonly isMaintenanceModeEnabled$: BehaviorSubject<boolean>;
	readonly isRegistrationEnabled$: BehaviorSubject<boolean>;
	readonly messageDoc$: BehaviorSubject<{
		messageEn: string;
		messageEs: string;
	}>;
	readonly shopClosedWeather$: BehaviorSubject<boolean>;
	readonly updateRegistration: (registration: Registration) => void;
}

export type CustomerStoryControlsFactory = () => CustomerStoryControls;

export const CUSTOMER_STORY_CONTROLS =
	new InjectionToken<CustomerStoryControls>('CUSTOMER_STORY_CONTROLS');

export interface CustomerStoryControlOptions {
	currentUser?: StoryUser | null;
	registration?: Registration;
	slots?: DateTimeSlot[];
	userProfile?: User;
	allowCancelRegistration?: boolean;
	allowChangeRegistration?: boolean;
	createAccountEnabled?: boolean | undefined;
	messageEn?: string;
	messageEs?: string;
}

class StoryTranslateLoader implements TranslateLoader {
	public getTranslation(language: string): Observable<TranslationObject> {
		return of(language === 'es' ? esTranslations : enTranslations);
	}
}

export const storyChildren: Child[] = [
	{
		id: 101,
		firstName: 'Maya',
		lastName: 'Garcia',
		dateOfBirth: new Date(2018, 3, 14),
		ageGroup: '6-8' as Child['ageGroup'],
		toyType: 'girls' as Child['toyType'],
		programYearAdded: 2026,
		enabled: true,
	},
	{
		id: 102,
		firstName: 'Theo',
		lastName: 'Garcia',
		dateOfBirth: new Date(2024, 8, 3),
		ageGroup: '0-2' as Child['ageGroup'],
		toyType: 'infants' as Child['toyType'],
		programYearAdded: 2026,
		enabled: true,
	},
];

export const storySlots: DateTimeSlot[] = [
	{
		id: 'sat-morning',
		programYear: 2026,
		dateTime: new Date('2026-12-05T16:00:00.000Z'),
		maxSlots: 40,
		slotsReserved: 12,
		enabled: true,
	},
	{
		id: 'sat-afternoon',
		programYear: 2026,
		dateTime: new Date('2026-12-05T20:00:00.000Z'),
		maxSlots: 40,
		slotsReserved: 39,
		enabled: true,
	},
	{
		id: 'sun-morning',
		programYear: 2026,
		dateTime: new Date('2026-12-06T17:00:00.000Z'),
		maxSlots: 40,
		slotsReserved: 8,
		enabled: true,
	},
];

export const storyRegistration: Registration = {
	uid: 'storybook-parent',
	qrCodeStoragePath: 'storybook/registration-code.png',
	firstName: 'Jordan',
	lastName: 'Garcia',
	emailAddress: 'jordan.garcia@example.com',
	programYear: 2026,
	children: storyChildren,
	dateTimeSlot: storySlots[0],
	registrationSubmittedOn: new Date('2026-10-20T18:00:00.000Z'),
	hasCheckedIn: false,
};

export const storyProfile: User = {
	uid: 'storybook-parent',
	firstName: 'Jordan',
	lastName: 'Garcia',
	emailAddress: 'jordan.garcia@example.com',
	zipCode: '80205',
	newsletter: true,
};

export function createCustomerStoryControls(
	options: CustomerStoryControlOptions = {},
): CustomerStoryControls {
	const registration = options.registration ?? storyRegistration;
	const children = registration.children ?? [];
	const dateTimeSlot = registration.dateTimeSlot as DateTimeSlot | undefined;
	const registrationSubmitted = !!registration.registrationSubmittedOn;
	const registrationComplete =
		children.length > 0 && !!dateTimeSlot && registrationSubmitted;
	const controls: CustomerStoryControls = {
		currentUser$: new BehaviorSubject<StoryUser | null>(
			options.currentUser === undefined
				? {
						displayName: 'Jordan Garcia',
						email: 'jordan.garcia@example.com',
						uid: 'storybook-parent',
					}
				: options.currentUser,
		),
		registration$: new BehaviorSubject(registration),
		registrationComplete$: new BehaviorSubject(registrationComplete),
		registrationSubmitted$: new BehaviorSubject(registrationSubmitted),
		hasCheckedIn$: new BehaviorSubject(!!registration.hasCheckedIn),
		children$: new BehaviorSubject(children),
		childCount$: new BehaviorSubject(children.length),
		noErrorsInChildren$: new BehaviorSubject(
			children.every((child) => !child.error),
		),
		dateTimeSlot$: new BehaviorSubject(dateTimeSlot),
		qrCode$: new BehaviorSubject(storyQrCodeDataUrl),
		slots$: new BehaviorSubject(options.slots ?? storySlots),
		userProfile$: new BehaviorSubject(options.userProfile ?? storyProfile),
		allowCancelRegistration$: new BehaviorSubject(
			options.allowCancelRegistration ?? true,
		),
		allowChangeRegistration$: new BehaviorSubject(
			options.allowChangeRegistration ?? true,
		),
		createAccountEnabled$: new BehaviorSubject<boolean | undefined>(
			options.createAccountEnabled ?? true,
		),
		globalAlert$: new BehaviorSubject<{ displayAlert: boolean }>({
			displayAlert: false,
		}),
		isMaintenanceModeEnabled$: new BehaviorSubject(false),
		isRegistrationEnabled$: new BehaviorSubject(true),
		messageDoc$: new BehaviorSubject({
			messageEn: options.messageEn ?? '',
			messageEs: options.messageEs ?? '',
		}),
		shopClosedWeather$: new BehaviorSubject(false),
		updateRegistration: (nextRegistration): void => {
			const nextChildren = nextRegistration.children ?? [];
			const nextDateTimeSlot = nextRegistration.dateTimeSlot as
				DateTimeSlot | undefined;
			controls.registration$.next(nextRegistration);
			controls.children$.next(nextChildren);
			controls.childCount$.next(nextChildren.length);
			controls.noErrorsInChildren$.next(
				nextChildren.every((child) => !child.error),
			);
			controls.dateTimeSlot$.next(nextDateTimeSlot);
			controls.registrationSubmitted$.next(
				!!nextRegistration.registrationSubmittedOn,
			);
			controls.registrationComplete$.next(
				nextChildren.length > 0 &&
					!!nextDateTimeSlot &&
					!!nextRegistration.registrationSubmittedOn,
			);
			controls.hasCheckedIn$.next(!!nextRegistration.hasCheckedIn);
		},
	};
	return controls;
}

const storyQrCodeDataUrl = `data:image/svg+xml,${encodeURIComponent(`
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Synthetic sample code">
		<rect width="240" height="240" fill="white"/>
		<g fill="#111">
			<path d="M20 20h60v60H20zm12 12v36h36V32zM160 20h60v60h-60zm12 12v36h36V32zM20 160h60v60H20zm12 12v36h36v-36z" fill-rule="evenodd"/>
			<path d="M100 20h20v20h-20zm20 20h20v20h-20zm-20 20h20v20h-20zm0 40h20v20h-20zm40 0h20v20h-20zm20 20h20v20h-20zm-60 20h20v20h-20zm40 0h20v20h-20zm60 0h20v20h-20zm-100 40h20v20h-20zm40-20h20v20h-20zm20 20h20v20h-20zm40 0h20v20h-20zm-100 20h20v20h-20zm40 0h20v20h-20zm60 0h20v20h-20z"/>
		</g>
		<rect x="34" y="98" width="172" height="44" rx="5" fill="#b3261e"/>
		<text x="120" y="116" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="700">SAMPLE</text>
		<text x="120" y="133" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="11">NON-VALID CODE</text>
	</svg>
`)}`;

export function customerStoryDecorators(
	options: CustomerStoryOptions = {},
): ReturnType<typeof applicationConfig>[] {
	return [
		applicationConfig({
			providers: createCustomerStoryProviders(options),
		}),
	];
}

export function getIonButton(
	container: HTMLElement,
	name: RegExp,
): HTMLIonButtonElement {
	const button = Array.from(container.querySelectorAll('ion-button')).find(
		(candidate) =>
			name.test(
				`${candidate.getAttribute('aria-label') ?? ''} ${candidate.textContent ?? ''}`.replace(
					/\s+/g,
					' ',
				),
			),
	);
	if (!button)
		throw new Error(`Could not find Ionic button matching ${name}`);
	return button;
}

function createCustomerStoryProviders(
	options: CustomerStoryOptions,
): (Provider | EnvironmentProviders)[] {
	const currentUser =
		options.currentUser === undefined
			? {
					displayName: 'Jordan Garcia',
					email: 'jordan.garcia@example.com',
					uid: 'storybook-parent',
				}
			: options.currentUser;
	const registration = options.registration ?? storyRegistration;
	const slots = options.slots ?? storySlots;
	const profile = options.userProfile ?? storyProfile;
	let controlsFactory: CustomerStoryControlsFactory;
	if (typeof options.controls === 'function') {
		controlsFactory = options.controls;
	} else {
		const staticControls = options.controls;
		controlsFactory = (): CustomerStoryControls =>
			staticControls ??
			createCustomerStoryControls({
				currentUser,
				registration,
				slots,
				userProfile: profile,
				allowCancelRegistration: options.allowCancelRegistration,
				allowChangeRegistration: options.allowChangeRegistration,
				createAccountEnabled: options.createAccountEnabled,
				messageEn: options.messageEn,
				messageEs: options.messageEs,
			});
	}

	return [
		...provideLocationMocks(),
		provideRouter(
			options.routes ?? [],
			withEnabledBlockingInitialNavigation(),
		),
		provideIonicAngular({ animated: false, mode: 'md' }),
		importProvidersFrom(
			TranslateModule.forRoot({
				fallbackLang: 'en',
				loader: {
					provide: TranslateLoader,
					useClass: StoryTranslateLoader,
				},
			}),
		),
		provideAppInitializer((): Promise<void> =>
			firstValueFrom(inject(TranslateService).use('en')).then(
				() => undefined,
			),
		),
		{ provide: PROGRAM_YEAR, useValue: 2026 },
		{
			provide: ActivatedRoute,
			useFactory: (): Partial<ActivatedRoute> =>
				createRoute(options.mode),
		},
		{
			provide: CUSTOMER_STORY_CONTROLS,
			useFactory: controlsFactory,
		},
		{
			provide: AuthService,
			useFactory: (controls: CustomerStoryControls): object => ({
				currentUser$: controls.currentUser$.asObservable(),
				uid$: controls.currentUser$.pipe(map((user) => user?.uid)),
				login: fn(async (): Promise<void> => undefined),
				logout: fn(async (): Promise<void> => undefined),
				resetPassword: fn(async (): Promise<void> => undefined),
				changeEmailAddress: fn(async (): Promise<void> => undefined),
				changePassword: fn(async (): Promise<void> => undefined),
				refreshCurrentUser: fn(async (): Promise<void> => undefined),
			}),
			deps: [CUSTOMER_STORY_CONTROLS],
		},
		{
			provide: CustomerLanguageService,
			useFactory: (translate: TranslateService): object => {
				const language$ = new BehaviorSubject<'en' | 'es'>('en');
				return {
					language$: language$.asObservable(),
					initialize: fn(),
					setLanguage: fn(
						async (language: 'en' | 'es'): Promise<void> => {
							translate.use(language).subscribe();
							window.localStorage.setItem(
								'santashop-language',
								language,
							);
							language$.next(language);
						},
					),
				};
			},
			deps: [TranslateService],
		},
		{
			provide: AppStateService,
			useFactory: (controls: CustomerStoryControls): object => ({
				allowCancelRegistration$:
					controls.allowCancelRegistration$.asObservable(),
				allowChangeRegistration$:
					controls.allowChangeRegistration$.asObservable(),
				createAccountEnabled$:
					controls.createAccountEnabled$.asObservable(),
				globalAlert$: controls.globalAlert$.asObservable(),
				isMaintenanceModeEnabled$:
					controls.isMaintenanceModeEnabled$.asObservable(),
				isRegistrationEnabled$:
					controls.isRegistrationEnabled$.asObservable(),
				messageDoc$: controls.messageDoc$.asObservable(),
				shopClosedWeather$: controls.shopClosedWeather$.asObservable(),
			}),
			deps: [CUSTOMER_STORY_CONTROLS],
		},
		{
			provide: PreRegistrationService,
			useFactory: (controls: CustomerStoryControls): object =>
				createPreRegistrationService(controls),
			deps: [CUSTOMER_STORY_CONTROLS],
		},
		{
			provide: ProfilePageService,
			useFactory: (controls: CustomerStoryControls): object =>
				createProfilePageService(controls),
			deps: [CUSTOMER_STORY_CONTROLS],
		},
		{
			provide: FireRepoLite,
			useFactory: (controls: CustomerStoryControls): object => ({
				collection: (name: string): object => ({
					read: fn(() =>
						name === 'users'
							? controls.userProfile$.asObservable()
							: controls.registration$.asObservable(),
					),
					readMany: fn(() => controls.slots$.asObservable()),
				}),
			}),
			deps: [CUSTOMER_STORY_CONTROLS],
		},
		{
			provide: FunctionsWrapper,
			useFactory: (): object => ({
				callableWrapper: fn(() =>
					fn(async () => ({ data: true as const })),
				),
				changeAccountInformation: fn(async () => ({
					data: true as const,
				})),
			}),
		},
		{
			provide: AnalyticsWrapper,
			useFactory: (): object => ({
				logEvent: fn(),
				logEventWithParams: fn(),
				logErrorEvent: fn(),
			}),
		},
		{
			provide: ErrorHandlerService,
			useFactory: (): object => ({
				handleError: fn(async () => undefined),
			}),
		},
		{
			provide: AlertController,
			useFactory: (): object => createOverlayController('cancel'),
		},
		{
			provide: ModalController,
			useFactory: (): object => createOverlayController('cancel'),
		},
		{
			provide: PopoverController,
			useFactory: (): object =>
				createOverlayController('cancel', options.popoverCreate),
		},
		{
			provide: LoadingController,
			useFactory: (): object => ({
				create: fn(async () => createOverlay()),
			}),
		},
		{
			provide: ToastController,
			useFactory: (): object => ({
				create: fn(async () => createOverlay()),
				dismiss: fn(async () => false),
			}),
		},
		{
			provide: Platform,
			useFactory: (): object => ({
				backButton: {
					subscribeWithPriority: fn(() => ({ unsubscribe: fn() })),
				},
				ready: fn(async () => undefined),
			}),
		},
		{ provide: ApplicationService, useFactory: (): object => ({}) },
	];
}

function createPreRegistrationService(
	controls: CustomerStoryControls,
): Pick<
	PreRegistrationService,
	| 'userRegistration$'
	| 'registrationComplete$'
	| 'registrationSubmitted$'
	| 'hasCheckedIn$'
	| 'children$'
	| 'childCount$'
	| 'noErrorsInChildren$'
	| 'dateTimeSlot$'
	| 'qrCode$'
	| 'saveDraftChild'
	| 'deleteDraftChild'
	| 'setDraftAppointment'
	| 'completeRegistration'
	| 'undoRegistration'
	| 'changeRegistrationDateTime'
> {
	return {
		userRegistration$: controls.registration$.asObservable(),
		registrationComplete$: controls.registrationComplete$.asObservable(),
		registrationSubmitted$: controls.registrationSubmitted$.asObservable(),
		hasCheckedIn$: controls.hasCheckedIn$.asObservable(),
		children$: controls.children$.asObservable(),
		childCount$: controls.childCount$.asObservable(),
		noErrorsInChildren$: controls.noErrorsInChildren$.asObservable(),
		dateTimeSlot$: controls.dateTimeSlot$.asObservable(),
		qrCode$: controls.qrCode$.asObservable(),
		saveDraftChild: fn(async () => ({ data: true as const })),
		deleteDraftChild: fn(async () => ({ data: true as const })),
		setDraftAppointment: fn(async () => ({ data: true as const })),
		completeRegistration: fn(async () => ({ data: true as const })),
		undoRegistration: fn(async () => ({ data: true as const })),
		changeRegistrationDateTime: fn(async () => ({ data: true as const })),
	};
}

function createProfilePageService(
	controls: CustomerStoryControls,
): Pick<
	ProfilePageService,
	| 'profileForm'
	| 'changeEmailForm'
	| 'changePasswordForm'
	| 'userProfile$'
	| 'updatePublicProfile'
	| 'changeEmailAddress'
	| 'changePassword'
> {
	const profileForm = newChangeInfoForm();
	profileForm.patchValue(controls.userProfile$.value);
	return {
		profileForm,
		changeEmailForm: changeEmailForm(),
		changePasswordForm: changePasswordForm(),
		userProfile$: controls.userProfile$.asObservable(),
		updatePublicProfile: fn(async () => undefined),
		changeEmailAddress: fn(async () => undefined),
		changePassword: fn(async () => undefined),
	};
}

function createRoute(
	mode: CustomerStoryOptions['mode'],
): Partial<ActivatedRoute> {
	const queryParamMap = convertToParamMap(mode ? { mode } : {});
	return {
		queryParamMap: of(queryParamMap),
		snapshot: { queryParamMap } as ActivatedRoute['snapshot'],
	};
}

function createOverlay(role = 'cancel'): object {
	return {
		message: '',
		present: fn(async () => undefined),
		dismiss: fn(async () => true),
		onDidDismiss: fn(async () => ({ role })),
	};
}

function createOverlayController(role: string, create?: OverlayCreate): object {
	return {
		create: create ?? fn(async () => createOverlay(role)),
		dismiss: fn(async () => true),
		getTop: fn(async () => undefined),
	};
}
