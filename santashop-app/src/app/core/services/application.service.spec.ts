import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { AppStateService } from '@santashop/core/customer';
import {
	createModalControllerMock,
	createAppStateServiceMock,
	provideFirestoreMock,
} from '../../../test-helpers';
import { OperationalNoticeComponent } from '../../features/operational-notice/operational-notice.component';
import { ApplicationService } from './application.service';

describe('ApplicationService', () => {
	let service: ApplicationService;
	let modalController: {
		create: ReturnType<typeof vi.fn>;
		getTop: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		modalController = createModalControllerMock() as unknown as {
			create: ReturnType<typeof vi.fn>;
			getTop: ReturnType<typeof vi.fn>;
		};
		TestBed.configureTestingModule({
			providers: [
				provideFirestoreMock(),
				{
					provide: ModalController,
					useValue: modalController,
				},
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
			],
		});
		service = TestBed.inject(ApplicationService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('displays a closure modal from synchronous release defaults', async (): Promise<void> => {
		TestBed.resetTestingModule();
		const present = vi.fn().mockResolvedValue(undefined);
		modalController.getTop.mockResolvedValue(undefined);
		modalController.create.mockResolvedValue({ present });
		TestBed.configureTestingModule({
			providers: [
				provideFirestoreMock(),
				{ provide: ModalController, useValue: modalController },
				{
					provide: AppStateService,
					useValue: {
						isMaintenanceModeEnabled$: of(true),
						shopClosedWeather$: of(false),
						isRegistrationEnabled$: of(true),
					},
				},
			],
		});
		const initialService = TestBed.inject(ApplicationService);
		for (let index = 0; index < 8; index++) await Promise.resolve();

		expect(modalController.create).toHaveBeenCalledWith(
			expect.objectContaining({ componentProps: { mode: 'maintenance' } }),
		);
		expect(present).toHaveBeenCalledOnce();
		initialService.ngOnDestroy();
	});

	it('opens a notice once and replaces an existing notice modal', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		const dismiss = vi.fn().mockResolvedValue(undefined);
		modalController.create.mockResolvedValue({ present });
		modalController.getTop.mockResolvedValue({
			component: OperationalNoticeComponent, dismiss,
		});

		await service.openModal('maintenance');
		await service.openModal('maintenance');

		expect(dismiss).toHaveBeenCalledOnce();
		expect(modalController.create).toHaveBeenCalledOnce();
		expect(present).toHaveBeenCalledOnce();
	});

	it('closes the notice by component reference when the constructor name is minified', async (): Promise<void> => {
		const dismiss = vi.fn().mockResolvedValue(undefined);
		const originalName = OperationalNoticeComponent.name;
		Object.defineProperty(OperationalNoticeComponent, 'name', { value: 'e', configurable: true });
		modalController.getTop.mockResolvedValue({ component: OperationalNoticeComponent, dismiss });

		try {
			await service.closeExistingModals();
		} finally {
			Object.defineProperty(OperationalNoticeComponent, 'name', { value: originalName, configurable: true });
		}

		expect(dismiss).toHaveBeenCalledOnce();
	});

	it('serializes rapid notice transitions so a stale async open cannot survive closure', async (): Promise<void> => {
		let activeModal: { component: typeof OperationalNoticeComponent; present: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> } | undefined;
		const present = vi.fn().mockImplementation(async (): Promise<void> => undefined);
		const dismiss = vi.fn().mockImplementation(async (): Promise<void> => { activeModal = undefined; });
		modalController.getTop.mockImplementation(async () => activeModal);
		modalController.create.mockImplementation(async () => {
			activeModal = { component: OperationalNoticeComponent, present, dismiss };
			return activeModal;
		});

		service.setModal('weather');
		service.setModal(undefined);
		for (let index = 0; index < 8; index++) await Promise.resolve();

		expect(modalController.create).toHaveBeenCalledOnce();
		expect(present).toHaveBeenCalledOnce();
		expect(dismiss).toHaveBeenCalledOnce();
		expect(activeModal).toBeUndefined();
	});

	it('does not dismiss a non-notice modal and tears down subscriptions', async (): Promise<void> => {
		const dismiss = vi.fn().mockResolvedValue(undefined);
		modalController.getTop.mockResolvedValue({ component: { name: 'OtherModal' }, dismiss });

		await service.closeExistingModals();
		service.ngOnDestroy();

		expect(dismiss).not.toHaveBeenCalled();
	});

	it('closes the tracked notice when no mode is requested', async (): Promise<void> => {
		modalController.getTop.mockResolvedValue(undefined);

		await service.openModal();

		expect(modalController.create).not.toHaveBeenCalled();
	});

	it('opens a weather notice with the non-dismissible workspace settings', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		modalController.getTop.mockResolvedValue(undefined);
		modalController.create.mockResolvedValue({ present });

		await service.openModal('weather');

		expect(modalController.create).toHaveBeenCalledWith(
			expect.objectContaining({
				componentProps: { mode: 'weather' },
				backdropDismiss: false,
				keyboardClose: false,
			}),
		);
		expect(present).toHaveBeenCalledOnce();
	});
});
