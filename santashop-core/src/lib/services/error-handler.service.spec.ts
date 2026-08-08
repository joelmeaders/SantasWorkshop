import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ErrorHandlerService } from './error-handler.service';
import { AlertController, LoadingController } from '@ionic/angular';
import { IError } from '@santashop/models';
import { AnalyticsWrapper } from './_analytics-wrapper';

describe('ErrorHandlerService', () => {
	let service: ErrorHandlerService;
	let analyticsWrapper: Mocked<AnalyticsWrapper>;
	let alertControllerService: Mocked<AlertController>;
	let loadingControllerService: Mocked<LoadingController>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: AnalyticsWrapper,
					useValue: {
						logEvent: vi
							.fn()
							.mockName('AnalyticsWrapperSpy.logEvent'),
						logErrorEvent: vi
							.fn()
							.mockName('AnalyticsWrapperSpy.logErrorEvent'),
					},
				},
				{
					provide: AlertController,
					useValue: {
						create: vi.fn().mockName('AlertControllerSpy.create'),
					},
				},
				{
					provide: LoadingController,
					useValue: {
						getTop: vi
							.fn()
							.mockName('LoadingControllerSpy.getTop')
							.mockResolvedValue(undefined),
					},
				},
			],
		});

		service = TestBed.inject(ErrorHandlerService);
		analyticsWrapper = TestBed.inject(
			AnalyticsWrapper,
		) as Mocked<AnalyticsWrapper>;
		alertControllerService = TestBed.inject(
			AlertController,
		) as Mocked<AlertController>;
		loadingControllerService = TestBed.inject(
			LoadingController,
		) as Mocked<LoadingController>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('handleError(): should make expected calls', async () => {
		// Arrange
		const error: IError = {
			code: 'Ohno',
			message: 'It happened again',
			details: 'some stack trace maybe',
		};

		const createAlertSpy = alertControllerService.create;
		const alertStub = {
			present: () => {
				/* mock */
			},
			onDidDismiss: () => {
				/* mock */
			},
		} as HTMLIonAlertElement;
		createAlertSpy.mockResolvedValue(alertStub);

		const logSpy = analyticsWrapper.logErrorEvent;

		// Act
		await service.handleError(error, 'Error Encountered', true);

		// Assert
		expect(createAlertSpy).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalledWith(error.code, error.message);
	});

	it('handleError(): should dismiss an active loading overlay before presenting the alert', async () => {
		const dismiss = vi.fn().mockResolvedValue(true);
		const present = vi.fn().mockResolvedValue(undefined);
		loadingControllerService.getTop.mockResolvedValue({
			dismiss,
		} as unknown as HTMLIonLoadingElement);
		alertControllerService.create.mockResolvedValue({
			present,
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'ok' }),
		} as unknown as HTMLIonAlertElement);

		await service.handleError({
			code: 'auth/invalid-credential',
			message: 'Invalid credentials',
			details: 'Please check your email address and password.',
		});

		expect(dismiss).toHaveBeenCalledOnce();
		expect(present).toHaveBeenCalledOnce();
		expect(dismiss.mock.invocationCallOrder[0]).toBeLessThan(
			present.mock.invocationCallOrder[0],
		);
	});

	it('handleError(): should still present the alert when loading dismissal fails', async () => {
		const present = vi.fn().mockResolvedValue(undefined);
		loadingControllerService.getTop.mockResolvedValue({
			dismiss: vi.fn().mockRejectedValue(new Error('already dismissed')),
		} as unknown as HTMLIonLoadingElement);
		alertControllerService.create.mockResolvedValue({
			present,
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'ok' }),
		} as unknown as HTMLIonAlertElement);

		await service.handleError({
			code: 'unknown',
			message: 'Unknown error',
			details: 'Please try again.',
		});

		expect(present).toHaveBeenCalledOnce();
	});

	it('can log without displaying an alert and tolerates analytics failures', async (): Promise<void> => {
		const present = vi.fn();
		analyticsWrapper.logErrorEvent.mockImplementation(() => {
			throw new Error('analytics unavailable');
		});
		alertControllerService.create.mockResolvedValue({
			present,
			onDidDismiss: vi.fn(),
		} as unknown as HTMLIonAlertElement);

		await expect(
			service.handleError(
				{ code: 'hidden', message: 'No dialog', details: 'details' },
				'Background error',
				false,
			),
		).resolves.toBeUndefined();
		expect(present).not.toHaveBeenCalled();
	});

	it('shows the retry guidance for registration submission failures', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		alertControllerService.create.mockResolvedValue(
			{ present } as unknown as HTMLIonAlertElement,
		);

		await service.completeRegistrationException({
			code: 'functions/internal',
			message: 'retry',
			details: 'details',
		});

		expect(alertControllerService.create).toHaveBeenCalledWith(
			expect.objectContaining({ header: 'Please try submitting again.' }),
		);
		expect(present).toHaveBeenCalledOnce();
	});
});
