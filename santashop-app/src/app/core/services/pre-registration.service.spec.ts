import {
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	type Mocked,
	vi,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import {
	AnalyticsWrapper,
	AuthService,
	FireRepoLite,
	FunctionsWrapper,
} from '@santashop/core';
import { autoSpyProvider } from '../../../../../test-helpers/vitest';
import { firstValueFrom, of } from 'rxjs';
import { PreRegistrationService } from './pre-registration.service';
import { repoCollectionStub } from '../../../../../test-helpers';
import { mockRegistrations } from '../../../../../test-helpers/mock-data';
import { QrCodeService } from './qrcode.service';
import { Registration } from '@santashop/models';

describe('PreRegistrationService', () => {
	let service: PreRegistrationService;
	let repository: Mocked<FireRepoLite>;
	let qrCodeService: Mocked<QrCodeService>;
	let analytics: Mocked<AnalyticsWrapper>;
	let alertController: Mocked<AlertController>;

	let collectionSpy: MockInstance;
	const collectionStub = repoCollectionStub();

	const userId = '12345';

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				autoSpyProvider(FireRepoLite),
				{ provide: AuthService, useValue: { uid$: of(userId) } },
				autoSpyProvider(QrCodeService),
				autoSpyProvider(FunctionsWrapper),
				{
					provide: AnalyticsWrapper,
					useValue: {
						logEventWithParams: vi
							.fn()
							.mockName('AnalyticsWrapper.logEventWithParams'),
					},
				},
				{
					provide: AlertController,
					useValue: {
						create: vi.fn().mockName('AlertController.create'),
					},
				},
			],
		});

		service = TestBed.inject(PreRegistrationService);
		repository = TestBed.inject(FireRepoLite) as Mocked<FireRepoLite>;
		qrCodeService = TestBed.inject(
			QrCodeService,
		) as Mocked<QrCodeService>;
		analytics = TestBed.inject(
			AnalyticsWrapper,
		) as Mocked<AnalyticsWrapper>;
		alertController = TestBed.inject(
			AlertController,
		) as Mocked<AlertController>;
		alertController.create.mockResolvedValue({
			present: () => Promise.resolve(),
		} as HTMLIonAlertElement);
	});

	beforeEach(() => {
		collectionSpy = repository.collection;
		collectionSpy.mockReturnValue(collectionStub);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('userRegistration$: should make expected calls', async () => {
		// Arrange
		const readSpy = vi.spyOn(collectionStub, 'read');
		readSpy.mockReturnValue(
			of(mockRegistrations(userId).complete.mockRegistration1),
		);

		// Act
		const registration = await firstValueFrom(service.userRegistration$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(readSpy).toHaveBeenCalledWith(userId, 'uid' as any);
		expect(registration?.uid).toEqual(userId);
	});

	it('registrationComplete$: should resolve false when no registration exists', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(of(undefined));

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(value).toBe(false);
	});

	it('userRegistration$: should alert and log when registration is missing', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(of(undefined));

		// Act
		await firstValueFrom(service.userRegistration$);
		await Promise.resolve();

		// Assert
		expect(analytics.logEventWithParams).toHaveBeenCalledWith(
			'registration_record_unavailable',
			{ reason: 'missing' },
		);
		expect(alertController.create).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'Registration record unavailable',
			}),
		);
	});

	it('registrationComplete$: should return true', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().complete.mockRegistration1),
		);

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(true);
	});

	it('registrationComplete$: should return false', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().incomplete.noRegistrationSubmittedOn),
		);

		// Act
		const value = await firstValueFrom(service.registrationComplete$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(false);
	});

	it('registrationSubmitted$: should return true', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().complete.mockRegistration1),
		);

		// Act
		const value = await firstValueFrom(service.registrationSubmitted$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(true);
	});

	it('registrationSubmitted$: should return false with no submitted on field', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().incomplete.noRegistrationSubmittedOn),
		);

		// Act
		const value = await firstValueFrom(service.registrationSubmitted$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(false);
	});

	it('children$: should get two children', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().complete.mockRegistration1),
		);
		// Act
		const value = await firstValueFrom(service.children$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toHaveLength(2);
	});

	it('children$: should get no children', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().incomplete.noChildren),
		);
		// Act
		const value = await firstValueFrom(service.children$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toHaveLength(0);
	});

	it('childCount$: should return 0', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().incomplete.noChildren),
		);
		// Act
		const value = await firstValueFrom(service.childCount$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(0);
	});

	it('childCount$: should return 2', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().complete.mockRegistration1),
		);
		// Act
		const value = await firstValueFrom(service.childCount$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(2);
	});

	it('noErrorsInChildren$: should return true', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().complete.mockRegistration1),
		);
		// Act
		const value = await firstValueFrom(service.noErrorsInChildren$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(true);
	});

	it('noErrorsInChildren$: should return false', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().incomplete.withChildrenError),
		);
		// Act
		const value = await firstValueFrom(service.noErrorsInChildren$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBe(false);
	});

	it('dateTimeSlot$: should return dateTimeSlot', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations().complete.mockRegistration1),
		);

		// Act
		const value = await firstValueFrom(service.dateTimeSlot$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(value).toBeDefined();
	});

	it('qrCode$: should make expected call', async () => {
		// Arrange
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(mockRegistrations(userId).complete.mockRegistration1),
		);

		const spy = qrCodeService.registrationQrCodeUrl;
		spy.mockResolvedValue('someurl');

		// Act
		const value = await firstValueFrom(service.qrCode$);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith('registrations');
		expect(spy).toHaveBeenCalledWith(
			`registrations/${userId}/test-asset.png`,
		);
		expect(value).toEqual('someurl');
	});

	it('qrCode$: should load the legacy UID path when the stored path is missing', async () => {
		const legacyRegistration = {
			...mockRegistrations(userId).complete.mockRegistration1,
			qrCodeStoragePath: undefined,
		};
		vi.spyOn(collectionStub, 'read').mockReturnValue(
			of(legacyRegistration as unknown as Registration),
		);
		qrCodeService.registrationQrCodeUrl.mockResolvedValue('legacy-url');

		const value = await firstValueFrom(service.qrCode$);

		expect(qrCodeService.registrationQrCodeUrl).toHaveBeenCalledWith(
			`registrations/${userId}.png`,
		);
		expect(value).toBe('legacy-url');
	});

	it('forwards draft mutations and rejects incomplete child or appointment input', async (): Promise<void> => {
		const functions = TestBed.inject(FunctionsWrapper) as unknown as Record<
			string,
			ReturnType<typeof vi.fn>
		>;
		for (const method of [
			'saveDraftChild',
			'deleteDraftChild',
			'setDraftAppointment',
			'completeRegistration',
			'undoRegistration',
			'changeRegistrationDateTime',
		]) {
			functions[method] = vi.fn().mockResolvedValue({ data: true });
		}
		const child = {
			id: 7,
			firstName: 'Taylor',
			lastName: 'Smith',
			dateOfBirth: new Date('2017-03-04T00:00:00.000Z'),
			toyType: 'toy',
		} as never;

		await service.saveDraftChild({ mutationId: 'mutation-1', child });
		await service.deleteDraftChild({ mutationId: 'mutation-2', childId: 7 });
		await service.setDraftAppointment({ mutationId: 'mutation-3', slotId: 'slot-1' });
		await service.completeRegistration({ mutationId: 'mutation-4' });
		await service.undoRegistration();
		await service.changeRegistrationDateTime({ id: 'slot-2' } as never);

		expect(functions['saveDraftChild']).toHaveBeenCalledWith(
			expect.objectContaining({
				mutationId: 'mutation-1',
				child: expect.objectContaining({
					id: 7,
					dateOfBirth: '2017-03-04T00:00:00.000Z',
				}),
			}),
		);
		expect(functions['deleteDraftChild']).toHaveBeenCalledWith({
			mutationId: 'mutation-2',
			childId: 7,
		});
		expect(functions['setDraftAppointment']).toHaveBeenCalledWith({
			mutationId: 'mutation-3',
			slotId: 'slot-1',
		});
		expect(functions['completeRegistration']).toHaveBeenCalledWith({
			mutationId: 'mutation-4',
		});
		expect(functions['undoRegistration']).toHaveBeenCalledWith(
			expect.objectContaining({ mutationId: expect.any(String) }),
		);
		expect(functions['changeRegistrationDateTime']).toHaveBeenCalledWith(
			expect.objectContaining({ slotId: 'slot-2' }),
		);
		await expect(
			service.saveDraftChild({ mutationId: 'mutation-5', child: {} as never }),
		).rejects.toThrow('Child ID is required.');
		await expect(
			service.changeRegistrationDateTime({} as never),
		).rejects.toThrow('Appointment ID is required.');
	});
});
