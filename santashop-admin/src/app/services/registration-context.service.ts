import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ICheckIn, IRegistration } from '@models/*';
import { BehaviorSubject, of } from 'rxjs';
import { filter, shareReplay, switchMap, tap } from 'rxjs/operators';
import { QrModalComponent } from '../components/qr-modal/qr-modal.component';
import { LookupService } from './lookup.service';

@Injectable({
  providedIn: 'root'
})
export class RegistrationContextService {

  private readonly _registration$ = new BehaviorSubject<IRegistration | undefined>(undefined);
  public readonly registration$ = this._registration$.asObservable().pipe(
    shareReplay(1)
  );

  private readonly _checkin$ = new BehaviorSubject<ICheckIn | undefined>(undefined);
  public readonly checkin$ = this._checkin$.asObservable().pipe(
    shareReplay(1)
  );

  private readonly newModal = () => 
    this.modalController.create({
      component: QrModalComponent,
      cssClass: 'modal-lg',
      backdropDismiss: false
    });

  public readonly setCheckinSubscription = 
    this.registration$.pipe(
      tap(registration => {
        if (!registration) 
          this._checkin$.next(undefined);
      }),
      filter(registration => !!registration),
      switchMap(registration => this.lookupService.getCheckinByUid$(registration?.uid!)),
      tap(checkin => this._checkin$.next(checkin))
    ).subscribe();

  public readonly openRegistrationModelSubscription =
    this.registration$.pipe(
      filter(registration => !!registration),
      switchMap(() => of(this.displayRegistrationModal()))
    ).subscribe();

  constructor(
    private readonly modalController: ModalController,
    private readonly lookupService: LookupService
  ) { }

  public setCurrentRegistration(registration?: IRegistration) {
    this._registration$.next(registration);
  }

  private async displayRegistrationModal() {

    const modal = await this.newModal(); 
    await modal.present();

    return modal.onDidDismiss().then(dismiss => {

      if (dismiss.role === 'cancel') {
        this.setCurrentRegistration();
      }

      if (dismiss.role === 'checkin') {
        this.setCurrentRegistration();
      }

      if (dismiss.role === 'edit') {
        // TODO: Edit functionality
      }

    });
  }
}
