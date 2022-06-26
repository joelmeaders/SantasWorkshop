import { TestBed } from '@angular/core/testing';
import { AuthService, FireRepoLite } from '@core/*';
import { Functions } from '@angular/fire/functions';
import { provideMock, Spied } from 'test-helpers/jasmine';
import { firstValueFrom, of } from 'rxjs';
import { IRegistration } from '@models/*';
import { QrCodeService } from './qrcode.service';
import { PreRegistrationService } from './pre-registration.service';
import { fireRepoLiteTestProvider } from 'santashop-core/src/lib/test-helpers/test-helpers';

describe('PreRegistrationService', () => {
	let service: PreRegistrationService;
	let fireRepo: FireRepoLite;
	let qrCodeService: Spied<QrCodeService>;

	const userId = '12345';
	const registration = {
		uid: userId,
		children: [{ id: '1' }, { id: '2' }] as any[],
		dateTimeSlot: { id: '1' },
	} as IRegistration;
	let registrationMock = of(registration);
	let readRegistrationSpy: jasmine.Spy;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				fireRepoLiteTestProvider(),
				{ provide: AuthService, useValue: { uid$: of(userId) } },
				provideMock(QrCodeService),
				provideMock(Functions),
			],
		});

		service = TestBed.inject(PreRegistrationService);
		fireRepo = TestBed.inject(FireRepoLite);
		qrCodeService = TestBed.inject(
			QrCodeService
		) as jasmine.SpyObj<QrCodeService>;

		readRegistrationSpy = spyOn(fireRepo, 'read').and.returnValue(
			registrationMock
		);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('userRegistration$: should make expected call', async () => {
		// Arrange
		const collectionSpy = spyOn(fireRepo, 'collection').and.callThrough();

		// Act
		const registration = await firstValueFrom(service.userRegistration$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(readRegistrationSpy).toHaveBeenCalledWith(
			'registrations',
			userId,
			<any>'uid'
		);
		expect(registration.uid).toEqual(userId);
	});

	it('registrationComplete$: should make expected call', async () => {
		// Arrange
		const spy = spyOn(service, 'isRegistrationComplete').and.resolveTo(
			true
		);

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(spy).toHaveBeenCalled();
		expect(value).toBeTrue();
	});

	// TODO: Make a true version
	it('registrationSubmitted$: should return false', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.registrationSubmitted$);

		// Assert
		expect(value).toBeFalse();
	});

	// TODO: Try with no children
	it('children$: should get both children', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.children$);

		// Assert
		expect(value.length).toBe(2);
	});

	// TODO: Try with no children
	it('childCount$: should return 2', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.childCount$);

		// Assert
		expect(value).toBe(2);
	});

	// TODO: Add another test that shows errors
	it('noErrorsInChildren$: should return true', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.noErrorsInChildren$);

		// Assert
		expect(value).toBeTrue();
	});

	// TODO: Add another test that shows errors
	it('dateTimeSlot$: should return dateTimeSlot', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.dateTimeSlot$);

		// Assert
		expect(value).toBeTruthy();
	});

	it('qrCode$: should make expected call', async () => {
		// Arrange
		const spy = qrCodeService.registrationQrCodeUrl;
		spy.and.resolveTo('someurl');

		// Act
		const value = await firstValueFrom(service.qrCode$);

		// Assert
		expect(value).toEqual('someurl');
		expect(spy).toHaveBeenCalledWith(userId);
	});

	it('qrCode$: should make expected call', async () => {
		// Arrange
		const spy = qrCodeService.registrationQrCodeUrl;
		spy.and.resolveTo('someurl');

		// Act
		const value = await firstValueFrom(service.qrCode$);

		// Assert
		expect(value).toEqual('someurl');
		expect(spy).toHaveBeenCalledWith(userId);
	});
});
