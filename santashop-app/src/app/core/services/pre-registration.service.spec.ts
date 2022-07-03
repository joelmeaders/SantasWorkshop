import { TestBed } from '@angular/core/testing';
import { AuthService, FireRepoLite } from '@core/*';
import { Functions } from '@angular/fire/functions';
import { provideMock, Spied } from 'test-helpers/jasmine';
import { firstValueFrom, of } from 'rxjs';
import { PreRegistrationService } from './pre-registration.service';
import { repoCollectionStub } from '../../../../../test-helpers';
import { mockRegistrations } from '../../../../../test-helpers/mock-data';
import { QrCodeService } from './qrcode.service';

describe('PreRegistrationService', () => {
	let service: PreRegistrationService;
	let fireRepo: Spied<FireRepoLite>;
	let qrCodeService: Spied<QrCodeService>;

	let collectionSpy: jasmine.Spy;
	const collectionStub = repoCollectionStub();

	const userId = '12345';

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				provideMock(FireRepoLite),
				{ provide: AuthService, useValue: { uid$: of(userId) } },
				provideMock(QrCodeService),
				provideMock(Functions),
			],
		});

		service = TestBed.inject(PreRegistrationService);
		fireRepo = TestBed.inject(FireRepoLite) as jasmine.SpyObj<FireRepoLite>;
		qrCodeService = TestBed.inject(
			QrCodeService
		) as jasmine.SpyObj<QrCodeService>;
	});

	beforeEach(() => {
		collectionSpy = fireRepo.collection;
		collectionSpy.and.returnValue(collectionStub);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('userRegistration$: should make expected calls', async () => {
		// Arrange
		const readSpy = spyOn(collectionStub, 'read');
		readSpy.and.returnValue(
			of(mockRegistrations(userId).complete.mockRegistration1)
		);

		// Act
		const registration = await firstValueFrom(service.userRegistration$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(readSpy).toHaveBeenCalledWith(userId, <any>'uid');
		expect(registration.uid).toEqual(userId);
	});

	it('registrationComplete$: should return true', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().complete.mockRegistration1)
		);

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeTrue();
	});

	it('registrationComplete$: should return false', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().incomplete.noRegistrationSubmittedOn)
		);

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeFalse();
	});

	it('registrationSubmitted$: should return true', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().complete.mockRegistration1)
		);

		// Act
		const value = await firstValueFrom(service.registrationSubmitted$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeTrue();
	});

	it('registrationSubmitted$: should return false with no submitted on field', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().incomplete.noRegistrationSubmittedOn)
		);

		// Act
		const value = await firstValueFrom(service.registrationSubmitted$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeFalse();
	});

	it('children$: should get two children', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().complete.mockRegistration1)
		);
		// Act
		const value = await firstValueFrom(service.children$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value.length).toBe(2);
	});

	it('children$: should get no children', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().incomplete.noChildren)
		);
		// Act
		const value = await firstValueFrom(service.children$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value.length).toBe(0);
	});

	it('childCount$: should return 0', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().incomplete.noChildren)
		);
		// Act
		const value = await firstValueFrom(service.childCount$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(0);
	});

	it('childCount$: should return 2', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().complete.mockRegistration1)
		);
		// Act
		const value = await firstValueFrom(service.childCount$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(2);
	});

	it('noErrorsInChildren$: should return true', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().complete.mockRegistration1)
		);
		// Act
		const value = await firstValueFrom(service.noErrorsInChildren$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeTrue();
	});

	it('noErrorsInChildren$: should return false', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().incomplete.withChildrenError)
		);
		// Act
		const value = await firstValueFrom(service.noErrorsInChildren$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeFalse();
	});

	it('dateTimeSlot$: should return dateTimeSlot', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations().complete.mockRegistration1)
		);

		// Act
		const value = await firstValueFrom(service.dateTimeSlot$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeDefined();
	});

	it('qrCode$: should make expected call', async () => {
		// Arrange
		spyOn(collectionStub, 'read').and.returnValue(
			of(mockRegistrations(userId).complete.mockRegistration1)
		);

		const spy = qrCodeService.registrationQrCodeUrl;
		spy.and.resolveTo('someurl');

		// Act
		const value = await firstValueFrom(service.qrCode$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(spy).toHaveBeenCalledWith(userId);
		expect(value).toEqual('someurl');
	});
});
