import { Injectable, inject, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { combineLatest, from, Subject } from 'rxjs';
import {
	distinctUntilChanged,
	switchMap,
	takeUntil,
	tap,
} from 'rxjs/operators';
import { AppStateService } from '@santashop/core/customer';
import {
	OperationalNoticeComponent,
	OperationalNoticeMode,
} from '../../features/operational-notice/operational-notice.component';

/**
 * Application-level service that manages modal state based on app configuration.
 * This service monitors the AppStateService and automatically displays/dismisses
 * modals for maintenance mode, weather closures, and registration status.
 */
@Injectable({
	providedIn: 'root',
})
export class ApplicationService implements OnDestroy {
	private readonly appStateService = inject(AppStateService);
	private readonly modalController = inject(ModalController);

	private readonly destroy$ = new Subject<void>();
	private readonly currentModal = new Subject<
		OperationalNoticeMode | undefined
	>();
	private displayedMode?: OperationalNoticeMode;

	private readonly currentModal$ = this.currentModal
		.asObservable()
		.pipe(distinctUntilChanged());

	/**
	 * Subscription that monitors app closure states and manages modals.
	 * Auto-subscribes when the service is instantiated.
	 */
	public readonly appClosureSubscription = combineLatest([
		this.appStateService.isMaintenanceModeEnabled$,
		this.appStateService.shopClosedWeather$,
		this.appStateService.isRegistrationEnabled$,
	])
		.pipe(
			takeUntil(this.destroy$),
				tap(([maintenance, weather, registration]) => {
				if (maintenance) {
					this.setModal('maintenance');
					return;
				}

				if (weather) {
					this.setModal('weather');
					return;
				}

				if (!registration) {
					this.setModal('registration-closed');
					return;
				}

				this.setModal(undefined);
			}),
		)
		.subscribe();

	/**
	 * Subscription that manages modal display/dismissal based on current modal state.
	 */
	public readonly modalSubscription = this.currentModal$
		.pipe(
			takeUntil(this.destroy$),
			switchMap((modal) => from(this.openModal(modal))),
		)
		.subscribe();

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	/**
	 * Sets which modal should be displayed.
	 * @param component The modal component to display, or undefined to close all.
	 */
	public setModal(mode?: OperationalNoticeMode): void {
		this.currentModal.next(mode);
	}

	/**
	 * Opens the specified modal, closing any existing notice modals first.
	 * @param toBeDisplayed The modal component to display.
	 */
	public async openModal(mode?: OperationalNoticeMode): Promise<void> {
		if (this.displayedMode === mode) return;

		// Close existing
		await this.closeExistingModals();

		if (!mode) return;

		const modal = await this.modalController.create({
			component: OperationalNoticeComponent,
			componentProps: { mode },
			backdropDismiss: false,
			keyboardClose: false,
			cssClass: 'disabled-backdrop',
		});

		await modal.present();
		this.displayedMode = mode;
	}

	/**
	 * Closes any existing notice modals (maintenance, weather, registration closed).
	 */
	public async closeExistingModals(): Promise<void> {
		const currentModal = await this.modalController.getTop();
		if (!currentModal) {
			this.displayedMode = undefined;
			return;
		}
		const currentModalName = (currentModal?.component as any)?.name;

		// Wrong modal displayed, don't close
		if (currentModalName !== 'OperationalNoticeComponent') return;

		await currentModal?.dismiss();
		this.displayedMode = undefined;
	}
}
