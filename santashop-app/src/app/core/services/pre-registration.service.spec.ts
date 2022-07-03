import { TestBed } from '@angular/core/testing';
import { AuthService, FireRepoLite } from '@core/*';
import { Functions } from '@angular/fire/functions';
import { provideMock, Spied } from 'test-helpers/jasmine';
import { firstValueFrom, of } from 'rxjs';
import { IRegistration } from '@models/*';
import { PreRegistrationService } from './pre-registration.service';

describe('PreRegistrationService', () => {
	let service: PreRegistrationService;
	let fireRepo: Spied<FireRepoLite>;
	// let qrCodeService: Spied<QrCodeService>;

	const userId = '12345';
	const mockRegistration = {
		uid: userId,
		children: [{ id: '1' }, { id: '2' }] as any[],
		dateTimeSlot: { id: '1' },
	} as IRegistration;
	const mockRegistration$ = of(mockRegistration);

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				provideMock(FireRepoLite),
				{ provide: AuthService, useValue: { uid$: of(userId) } },
				// provideMock(QrCodeService),
				provideMock(Functions),
			],
		});

		service = TestBed.inject(PreRegistrationService);
		fireRepo = TestBed.inject(FireRepoLite) as jasmine.SpyObj<FireRepoLite>;
		// qrCodeService = TestBed.inject(
		// 	QrCodeService
		// ) as jasmine.SpyObj<QrCodeService>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('userRegistration$: should make expected calls', async () => {
		// Arrange
		const readStub = { read: () => {} } as any;
		const collectionSpy = fireRepo.collection;
		collectionSpy.and.returnValue(readStub);

		const readSpy = spyOn(readStub, 'read');
		readSpy.and.returnValue(mockRegistration$);

		// Act
		const registration = await firstValueFrom(service.userRegistration$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(readSpy).toHaveBeenCalledWith(userId, <any>'uid');
		expect(registration.uid).toEqual(userId);
	});

	it('registrationComplete$: should make expected call', async () => {
		// Arrange

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(value).toBeTrue();
	});

	// // TODO: Make a true version
	// it('registrationSubmitted$: should return false', async () => {
	// 	// Arrange

	// 	// Act
	// 	const value = await firstValueFrom(service.registrationSubmitted$);

	// 	// Assert
	// 	expect(value).toBeFalse();
	// });

	// // TODO: Try with no children
	// it('children$: should get both children', async () => {
	// 	// Arrange

	// 	// Act
	// 	const value = await firstValueFrom(service.children$);

	// 	// Assert
	// 	expect(value.length).toBe(2);
	// });

	// // TODO: Try with no children
	// it('childCount$: should return 2', async () => {
	// 	// Arrange

	// 	// Act
	// 	const value = await firstValueFrom(service.childCount$);

	// 	// Assert
	// 	expect(value).toBe(2);
	// });

	// // TODO: Add another test that shows errors
	// it('noErrorsInChildren$: should return true', async () => {
	// 	// Arrange

	// 	// Act
	// 	const value = await firstValueFrom(service.noErrorsInChildren$);

	// 	// Assert
	// 	expect(value).toBeTrue();
	// });

	// // TODO: Add another test that shows errors
	// it('dateTimeSlot$: should return dateTimeSlot', async () => {
	// 	// Arrange

	// 	// Act
	// 	const value = await firstValueFrom(service.dateTimeSlot$);

	// 	// Assert
	// 	expect(value).toBeTruthy();
	// });

	// it('qrCode$: should make expected call', async () => {
	// 	// Arrange
	// 	const spy = qrCodeService.registrationQrCodeUrl;
	// 	spy.and.resolveTo('someurl');

	// 	// Act
	// 	const value = await firstValueFrom(service.qrCode$);

	// 	// Assert
	// 	expect(value).toEqual('someurl');
	// 	expect(spy).toHaveBeenCalledWith(userId);
	// });

	// it('qrCode$: should make expected call', async () => {
	// 	// Arrange
	// 	const spy = qrCodeService.registrationQrCodeUrl;
	// 	spy.and.resolveTo('someurl');

	// 	// Act
	// 	const value = await firstValueFrom(service.qrCode$);

	// 	// Assert
	// 	expect(value).toEqual('someurl');
	// 	expect(spy).toHaveBeenCalledWith(userId);
	// });
});
