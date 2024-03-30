import { Injectable, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { combineLatest, from, Observable, Subject } from 'rxjs';
import {
	distinctUntilChanged,
	filter,
	map,
	shareReplay,
	switchMap,
	takeUntil,
	tap,
} from 'rxjs/operators';
import { FireRepoLite, filterNil } from '@santashop/core';
import { COLLECTION_SCHEMA, PublicParameters } from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { BadWeatherPage } from '../../features/bad-weather/bad-weather.page';
import { MaintenancePage } from '../../features/maintenance/maintenance.page';
import { RegistrationClosedPage } from '../../features/registration-closed/registration-closed.page';

@Injectable({
	providedIn: 'root',
})
export class AppStateService implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	private readonly currentModal = new Subject<any>();
	private readonly currentModal$ = this.currentModal
		.asObservable()
		.pipe(distinctUntilChanged((prev, curr) => prev?.name === curr?.name));

	private readonly publicDoc$: Observable<PublicParameters> = this.httpService
		.collection<PublicParameters>(COLLECTION_SCHEMA.parameters)
		.read('public')
		.pipe(
			takeUntil(this.destroy$),
			filterNil(),
			distinctUntilChanged((prev, curr) => {
				return JSON.stringify(prev) === JSON.stringify(curr);
			}),
			shareReplay(1),
		);

	public readonly globalAlert$ = this.publicDoc$.pipe(
		map((doc) => doc?.globalAlert ?? undefined),
		filter((value) => !!value),
		map((doc) => {
			const enabled = doc.displayAlert;
			const isEnglish = this.translateService.currentLang === 'en';
			const title = isEnglish ? doc.titleEn : doc.titleEs;
			const message = isEnglish ? doc.messageEn : doc.messageEs;
			return { enabled, title, message };
		}),
		shareReplay(1),
	);

	public readonly message$: Observable<string | null> = this.publicDoc$.pipe(
		map((doc) => {
			const message =
				this.translateService.currentLang === 'en'
					? doc.messageEn
					: doc.messageEs;
			return message?.length ? message : null;
		}),
		shareReplay(1),
	);

	public readonly isMaintenanceModeEnabled$ = this.publicDoc$.pipe(
		map((value) => value.maintenanceModeEnabled),
		takeUntil(this.destroy$),
	);

	public readonly isRegistrationEnabled$ = this.publicDoc$.pipe(
		map((value) => value.registrationEnabled),
		takeUntil(this.destroy$),
	);

	public readonly shopClosedWeather$ = this.publicDoc$.pipe(
		map((value) => value.weatherModeEnabled),
		takeUntil(this.destroy$),
	);

	public readonly appClosureSubscription = combineLatest([
		this.isMaintenanceModeEnabled$,
		this.shopClosedWeather$,
		this.isRegistrationEnabled$,
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

	public readonly modalSubscription = this.currentModal$
		.pipe(
			takeUntil(this.destroy$),
			switchMap((modal) => from(this.openModal(modal))),
		)
		.subscribe();

	constructor(
		private readonly httpService: FireRepoLite,
		private readonly modalController: ModalController,
		private readonly translateService: TranslateService,
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public setModal(component: any): void {
		this.currentModal.next(component);
	}

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
