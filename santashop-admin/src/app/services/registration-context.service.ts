import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { ICheckIn, IRegistration } from '@models/*';
import { BehaviorSubject, of } from 'rxjs';
import {
	distinctUntilChanged,
	filter,
	shareReplay,
	switchMap,
	tap,
} from 'rxjs/operators';
import { QrModalComponent } from '../components/qr-modal/qr-modal.component';
import { LookupService } from './lookup.service';

@Injectable({
	providedIn: 'root',
})
export class RegistrationContextService {
	private readonly _registration$ = new BehaviorSubject<
		IRegistration | undefined
	>(undefined);
	public readonly registration$ = this._registration$.asObservable().pipe(
		distinctUntilChanged((p, c) => p?.uid === c?.uid),
		shareReplay(1)
	);

	private readonly _checkin$ = new BehaviorSubject<ICheckIn | undefined>(
		undefined
	);
	public readonly checkin$ = this._checkin$
		.asObservable()
		.pipe(shareReplay(1));

	private readonly newModal = () =>
		this.modalController.create({
			component: QrModalComponent,
			cssClass: 'modal-md',
			backdropDismiss: false,
			id: 'qr-modal',
		});

	public readonly setCheckinSubscription = this.registration$
		.pipe(
			tap((registration) => {
				if (!registration) this._checkin$.next(undefined);
			}),
			filter((registration) => !!registration),
			switchMap((registration) =>
				this.lookupService.getCheckinByUid$(registration?.uid!)
			),
			tap((checkin) => this._checkin$.next(checkin))
		)
		.subscribe();

	public readonly openRegistrationModalSubscription = this.registration$
		.pipe(
			filter((registration) => !!registration),
			switchMap(() => of(this.displayRegistrationModal()))
		)
		.subscribe();

	constructor(
		private readonly modalController: ModalController,
		private readonly lookupService: LookupService,
		private readonly router: Router
	) {}

	public setCurrentRegistration(registration?: IRegistration) {
		this._registration$.next(registration);
	}

	public reset() {
		this._registration$.next(undefined);
		this._checkin$.next(undefined);
	}

	private async displayRegistrationModal() {
		const currentModal = await this.modalController.getTop();

		if (currentModal && currentModal?.id === 'qr-modal') {
			return;
		}

		const modal = await this.newModal();
		await modal.present();

		return modal.onDidDismiss().then((dismiss) => {
			if (dismiss.role === 'cancel') {
				this.setCurrentRegistration();
				this.reset();
			}

			if (dismiss.role === 'checkin') {
				this.setCurrentRegistration();
				this.reset();
			}

			if (dismiss.role === 'edit') {
				this.router.navigate(['/admin/register']);
			}
		});
	}
}
