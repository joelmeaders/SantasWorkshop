import { Injectable, inject, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { combineLatest, from, Subject } from 'rxjs';
import {
	distinctUntilChanged,
	switchMap,
	takeUntil,
	tap,
} from 'rxjs/operators';
import { AppStateService } from '@santashop/core';
import { BadWeatherPage } from '../../features/bad-weather/bad-weather.page';
import { MaintenancePage } from '../../features/maintenance/maintenance.page';
import { RegistrationClosedPage } from '../../features/registration-closed/registration-closed.page';

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
	private readonly currentModal = new Subject<any>();

	private readonly currentModal$ = this.currentModal
		.asObservable()
		.pipe(distinctUntilChanged((prev, curr) => prev?.name === curr?.name));

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
					this.setModal(MaintenancePage);
					return;
				}

				if (weather) {
					this.setModal(BadWeatherPage);
					return;
				}

				if (!registration) {
					this.setModal(RegistrationClosedPage);
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
	public setModal(component: any): void {
		this.currentModal.next(component);
	}

	/**
	 * Opens the specified modal, closing any existing notice modals first.
	 * @param toBeDisplayed The modal component to display.
	 */
	public async openModal(toBeDisplayed: any): Promise<void> {
		const currentlyDisplayed = await this.modalController.getTop();
		const currentlyDisplayedName = (currentlyDisplayed?.component as any)
			?.name;

		// Modal is already up
		if (currentlyDisplayedName === toBeDisplayed?.name) return;

		// Close existing
		await this.closeExistingModals();

		if (!toBeDisplayed) return;

		const modal = await this.modalController.create({
			component: toBeDisplayed,
			backdropDismiss: false,
			keyboardClose: false,
			cssClass: 'disabled-backdrop',
		});

		await modal.present();
	}

	/**
	 * Closes any existing notice modals (maintenance, weather, registration closed).
	 */
	public async closeExistingModals(): Promise<void> {
		const noticeModalNames = [
			'RegistrationClosedPage',
			'BadWeatherPage',
			'MaintenancePage',
		];

		const currentModal = await this.modalController.getTop();
		const currentModalName = (currentModal?.component as any)?.name;

		// Wrong modal displayed, don't close
		if (!noticeModalNames.includes(currentModalName)) return;

		await currentModal?.dismiss();
	}
}
