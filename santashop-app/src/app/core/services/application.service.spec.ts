import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { AppStateService } from '@santashop/core/customer';
import {
	createModalControllerMock,
	createAppStateServiceMock,
	provideFirestoreMock,
} from '../../../test-helpers';
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

	it('opens a notice once and replaces an existing notice modal', async (): Promise<void> => {
		const present = vi.fn().mockResolvedValue(undefined);
		const dismiss = vi.fn().mockResolvedValue(undefined);
		modalController.create.mockResolvedValue({ present });
		modalController.getTop.mockResolvedValue({
			component: { name: 'OperationalNoticeComponent' }, dismiss,
		});

		await service.openModal('maintenance');
		await service.openModal('maintenance');

		expect(dismiss).toHaveBeenCalledOnce();
		expect(modalController.create).toHaveBeenCalledOnce();
		expect(present).toHaveBeenCalledOnce();
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
