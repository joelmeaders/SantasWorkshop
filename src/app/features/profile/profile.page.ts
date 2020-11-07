import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ChildProfile } from '@app/core/models/child-profile.model';
import { IRegistrationDateTime, Registration } from '@app/core/models/registration.model';
import { AuthService } from '@app/core/services/auth.service';
import { ChildProfileService } from '@app/core/services/http/child-profile.service';
import { RegistrationService } from '@app/core/services/http/registration.service';
import { CreateChildModalComponent } from '@app/shared/components/create-child-modal/create-child-modal.component';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { ArrivalDateForm } from '@app/shared/forms/arrival-date';
import { Helpers } from '@app/shared/helpers';
import { AlertController, LoadingController, ModalController, PopoverController } from '@ionic/angular';
import { BehaviorSubject, combineLatest, merge, Observable, of, Subject, throwError } from 'rxjs';
import { catchError, concatMap, delay, filter, map, mapTo, mergeMap, publishReplay, refCount, retry, retryWhen, shareReplay, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { AngularFireStorage } from '@angular/fire/storage';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePage implements OnDestroy {
  private readonly $destroy = new Subject<void>();

  public readonly dateTimeForm = ArrivalDateForm.form();
  public readonly dateTimeValidationMessages = ArrivalDateForm.validationMessages();

  private readonly _$isModify = new BehaviorSubject<boolean>(false);
  public readonly $isModify = this._$isModify.pipe(
    takeUntil(this.$destroy),
    shareReplay(1)
  );

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $customer = this.authService.$userProfile.pipe(
    takeUntil(this.$destroy),
    filter(profile => !!profile),
    shareReplay(1)
  );

  public readonly $children = this.$customer.pipe(
    takeUntil(this.$destroy),
    switchMap(parent =>
      this.childProfileService.getChildrenByParent(parent.id)),
    shareReplay(1)
  );

  private readonly $registrationQuery = this.$customer.pipe(
    takeUntil(this.$destroy),
    switchMap(customer =>
      this.registrationService.getRegistrationByParent(customer.id)),
    publishReplay(1),
    refCount()
  );

  public readonly $registrationCode = this.$registrationQuery.pipe(
    takeUntil(this.$destroy),
    filter(response => !!response?.code),
    map((response: Registration) => response.code),
    publishReplay(1),
    refCount()
  );

  public readonly $hasRegistered = this.$registrationQuery.pipe(
    takeUntil(this.$destroy),
    map(response => !!response?.children?.length && !!response.date && !!response.code),
    shareReplay(1)
  )

  public readonly $registrationDate = this.$registrationQuery.pipe(
    takeUntil(this.$destroy),
    map(response => (response?.date && response?.time) ? response : null),
    tap(response => {
      if (response) {
        this.dateTimeForm.controls['date'].setValue(response.date);
        this.dateTimeForm.controls['time'].setValue(response.time);
      }
    }),
    publishReplay(1),
    refCount()
  );

  public readonly $registrationEnabled = combineLatest([
    this.$registrationDate, this.$children
  ]).pipe(
    takeUntil(this.$destroy),
    map(([registrationDate, children]) => !!registrationDate && !!children?.length),
    shareReplay(1)
  );

  private readonly _$qrLoading = new BehaviorSubject<boolean>(false);
  public readonly $qrLoading = this._$qrLoading.pipe(
    takeUntil(this.$destroy),
    shareReplay(1)
  );

  public $qrCode = this.$registrationCode.pipe(
    takeUntil(this.$destroy),
    filter(code => !!code),
    tap(() => this._$qrLoading.next(true)),
    mergeMap(code => this.storage.ref(`registrations/${code}.png`).getDownloadURL().pipe(
      retryWhen(errors => errors.pipe(
        delay(3000),
        take(10),
      )),
      catchError((error) => of('Refresh Page'))
    )),
    tap(() => this._$qrLoading.next(false)),
    shareReplay(1)
  );

  // Because of rxjs bug with change detection
  private cdSubscription = merge(
    this.$customer, this.$children, this.$registrationCode
  ).pipe(
    takeUntil(this.$destroy),
    switchMap(() => of(undefined).pipe(delay(200))),
    tap(() => this.changeDetection.detectChanges())
  ).subscribe();

  constructor(
    private readonly authService: AuthService,
    private readonly childProfileService: ChildProfileService,
    private readonly registrationService: RegistrationService,
    private readonly changeDetection: ChangeDetectorRef,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly loadingController: LoadingController,
    private readonly popoverController: PopoverController,
    private readonly storage: AngularFireStorage,
    private readonly analyticsService: AngularFireAnalytics,
    private readonly router: Router
  ) {
    analyticsService.setCurrentScreen('profile');
    analyticsService.logEvent('screen_view');
   }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  public async addEditChild(inputChild?: ChildProfile): Promise<void> {

    const modal = await this.modalController.create({
      component: CreateChildModalComponent,
      cssClass: 'modal-md',
      componentProps: {
        item: inputChild,
      },
    });

    await modal.present();

    await modal.onDidDismiss().then(async (response) => {
      if (response && response.data) {
        const child = response.data as ChildProfile;

        if (!child.parentId) {
          const parent = await this.$customer.pipe(take(1)).toPromise();
          child.parentId = parent.id;
        }

        let didAdd = false;

        if (!!child?.id) {
          didAdd = false;
        } else {
          didAdd = true;
        }

        await this.saveChild(child).toPromise();

        this.analyticsService.logEvent(didAdd ? 'child_add' : 'child_edit');
      }
    });
  }

  public saveChild(child: ChildProfile): Observable<ChildProfile> {
    
    window.addEventListener('beforeunload', (event) => {
      if (this._$isModify.getValue()) {
        event.returnValue = 'Did you remember to submit/update your registration?';
      }
    });

    return this.childProfileService
      .save(child, true)
      .pipe(
        take(1),
        catchError((error) => {
          return throwError(error);
        })
      );
  }

  public async saveDateTime() {

    const dateTime: IRegistrationDateTime = {
      ...this.dateTimeForm.value
    };

    if (!dateTime.date || !dateTime.time) {
      await this.missingDateTimeAlert();
      return;
    }

    this._$loading.next(true);

    const customer = await this.$customer.pipe(take(1)).toPromise();

    await this.registrationService.storePartialRegistration(customer, dateTime)
      .pipe(take(1)).toPromise().finally(() => {
        this._$loading.next(false);
      });

    this.analyticsService.logEvent('save_datetime');
    this.changeDetection.detectChanges();

    await this.savedDateTimeAlert();
  }

  public async confirmRegistration() {

    const choice = await this.proceedWithRegistration();

    if (choice?.role === 'cancel') {
      return;
    }

    const dateTime: IRegistrationDateTime = {
      ...this.dateTimeForm.value
    };

    if (!dateTime.date || !dateTime.time) {
      await this.missingDateTimeAlert();
      return;
    }

    this._$loading.next(true);

    const customer = await this.$customer.pipe(take(1)).toPromise();
    const children = await this.$children.pipe(take(1)).toPromise();

    await this.registrationService.storeRegistration(customer, children, dateTime)
      .pipe(take(1)).toPromise().then(response => {
        this._$loading.next(false);
      });

    this.analyticsService.logEvent('submit_registration');
    this._$isModify.next(false);

    await this.emailAlert();

    this.changeDetection.detectChanges();
    this.router.navigateByUrl('/profile#top');
  }

  private async proceedWithRegistration() {
    const alert = await this.alertController.create({
      header: 'Are you finished adding your children?',
      subHeader: 'Click "Go Back" if your are not done',
      message: `If you're finished adding your children click "Register" to finish registering`,
      buttons: [
        {
          text: 'Go Back',
          role: 'cancel'
        },
        {
          text: 'Register'
        }
      ]
    });

    await alert.present();

    return alert.onDidDismiss();
  }

  public async modifyRegistration() {
    const choice = await this.proceedWithCancellation();

    if (choice?.role === 'cancel') {
      return;
    }

    this.analyticsService.logEvent('_edit_registration');

    this._$isModify.next(true);
    this.changeDetection.detectChanges();
  }

  private async proceedWithCancellation() {
    const alert = await this.alertController.create({
      header: 'This will delete your registration',
      message: `Remember to register again once you're done making changes`,
      buttons: [
        {
          text: 'Go Back',
          role: 'cancel'
        },
        {
          text: 'I Understand'
        }
      ]
    });

    await alert.present();

    return alert.onDidDismiss();
  }

  private async missingDateTimeAlert() {
    const alert = await this.alertController.create({
      header: 'Missing Information',
      message: `You need to choose your arrival date and time`,
      buttons: [
        { text: 'Ok'}
      ]
    });

    await alert.present();

    return alert.onDidDismiss();
  }

  private async emailAlert() {
    const alert = await this.alertController.create({
      header: 'Email Confirmation Sent',
      subHeader: 'Check your spam folder',
      message: `Save or print the email we sent you. You will need it on the day of the event to check in.`,
      buttons: [
        { text: 'Ok'}
      ]
    });

    await alert.present();

    return alert.onDidDismiss();
  }
  
  private async savedDateTimeAlert() {
    const alert = await this.alertController.create({
      header: 'Date/Time Saved',
      message: `Our system is updated with your new date and time.`,
      buttons: [
        { text: 'Ok'}
      ]
    });

    await alert.present();

    return alert.onDidDismiss();
  }

  public async profileMenu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event
    });
    return await popover.present();
  }
}
