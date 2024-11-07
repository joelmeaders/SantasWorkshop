import { TestBed } from '@angular/core/testing';
import { ErrorHandlerService } from '@core/*';
import { AlertController } from '@ionic/angular/standalone';
import { IError } from '../../../../dist/santashop-models';
import { AnalyticsWrapper } from './_analytics-wrapper';

describe('ErrorHandlerService', () => {
	let service: ErrorHandlerService;
	let analyticsWrapper: jasmine.SpyObj<AnalyticsWrapper>;
	let alertControllerService: jasmine.SpyObj<AlertController>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: AnalyticsWrapper,
					useValue: jasmine.createSpyObj<AnalyticsWrapper>(
						'AnalyticsWrapperSpy',
						['logEvent'],
					),
				},
				{
					provide: AlertController,
					useValue: jasmine.createSpyObj<AlertController>(
						'AlertControllerSpy',
						['create'],
					),
				},
			],
		});

		service = TestBed.inject(ErrorHandlerService);
		analyticsWrapper = TestBed.inject(
			AnalyticsWrapper,
		) as jasmine.SpyObj<AnalyticsWrapper>;
		alertControllerService = TestBed.inject(
			AlertController,
		) as jasmine.SpyObj<AlertController>;
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
			present: () => {},
			onDidDismiss: () => {},
		} as HTMLIonAlertElement;
		createAlertSpy.and.resolveTo(alertStub);

		const logSpy = analyticsWrapper.logErrorEvent;

		// Act
		await service.handleError(error, true);

		// Assert
		expect(createAlertSpy).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalledWith(error.code, error.message);
	});
});
