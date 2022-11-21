import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { CheckIn, Registration } from '@models/';
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
	private readonly registration = new BehaviorSubject<
		Registration | undefined
	>(undefined);
	public readonly registration$ = this.registration.asObservable().pipe(
		distinctUntilChanged((p, c) => p?.uid === c?.uid),
		shareReplay(1)
	);

	private readonly checkin = new BehaviorSubject<CheckIn | undefined>(
		undefined
	);
	public readonly checkin$ = this.checkin.asObservable().pipe(shareReplay(1));

	private readonly newModal = (): Promise<HTMLIonModalElement> =>
		this.modalController.create({
			component: QrModalComponent,
			cssClass: 'modal-md',
			backdropDismiss: false,
			id: 'qr-modal',
		});

	public readonly setCheckinSubscription = this.registration$
		.pipe(
			tap((registration) => {
				if (!registration) this.checkin.next(undefined);
			}),
			filter((registration) => !!registration?.uid),
			switchMap((registration) =>
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
				this.lookupService.getCheckinByUid$(registration?.uid!)
			),
			tap((checkin) => this.checkin.next(checkin))
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

	public setCurrentRegistration(registration?: Registration): void {
		this.registration.next(registration);
	}

	public reset(): void {
		this.registration.next(undefined);
		this.checkin.next(undefined);
	}

	private async displayRegistrationModal(): Promise<void> {
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
