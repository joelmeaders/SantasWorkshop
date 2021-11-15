import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { takeUntil, publishReplay, refCount, map, switchMap, filter, take } from 'rxjs/operators';
import { QuickRegistrationForms } from 'santashop-admin/src/app/forms/quick-registration';
import { CheckInHelpers } from 'santashop-admin/src/app/helpers/checkin-helpers';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';
import { IChildrenInfo, IError, IRegistration } from 'santashop-core/src';

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPage implements OnDestroy {

  public readonly customerForm: FormGroup = QuickRegistrationForms.customerForm(null);
  public readonly customerFormValidationMessages = QuickRegistrationForms.customerValidationMessages();

  public readonly childForm: FormGroup = QuickRegistrationForms.childForm(null);
  public readonly childFormValidationMessages = QuickRegistrationForms.childValidationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new BehaviorSubject<boolean>(false);
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly _$zipCode = new BehaviorSubject<string>(undefined);
  public readonly $zipCode = this._$zipCode.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly _$children = new BehaviorSubject<Array<IChildrenInfo>>(new Array<IChildrenInfo>());
  public readonly $children = this._$children.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $canCheckIn = combineLatest([
    this.$zipCode, this.$children
  ]).pipe(
    takeUntil(this.$destroy),
    map(([zip, children]) => !!zip && !!children?.length),
    publishReplay(1),
    refCount()
  );

  private readonly _$isEdit = new BehaviorSubject<boolean>(false);

  public readonly registrationEditSubscription = this.checkInService.$manualRegistrationEdit.pipe(
    takeUntil(this.$destroy),
    filter(response => !!response),
    switchMap(registration => this.initRegistrationEdit(registration))
  ).subscribe();

  constructor(
    private readonly loadingController: LoadingController,
    private readonly checkInService: CheckInService,
    private readonly alertController: AlertController
  ) { }

  public async initRegistrationEdit(registration: IRegistration): Promise<void> {
    this.setZip(registration.zipCode);
    this.customerForm.get('zipCode').setValue(registration.zipCode);
    this._$children.next(registration.children);
    this._$isEdit.next(true);
  }

  public async completeRegistration() {

    if (this._$zipCode.getValue().length !== 5) {
      await this.invalidZipAlert();
      return;
    }

    await this.presentLoading();
    const registration = await this.createRegistration();
    await this.checkInService.saveCheckIn(registration, this._$isEdit.getValue());
    this.reset();
    await this.dismissLoading();
    await this.checkInService.checkinCompleteAlert();
    this.checkInService.reset();
  }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  public reset(): void {
    this._$zipCode.next(undefined);
    this._$children.next(new Array<IChildrenInfo>());
    this.checkInService.reset();
    this.customerForm.reset();
    this.childForm.reset();
    this._$isEdit.next(false);
  }

  public deleteChild(index: number) {
    const current = this._$children.getValue();
    current.splice(index, 1);
    this._$children.next(CheckInHelpers.sortChildren(current));
  }

  public setZip(value: string) {
    this._$zipCode.next(value);
  }

  private async presentLoading() {
    const loading = await this.loadingController.create({
      message: 'Saving registration...',
      translucent: true,
      backdropDismiss: true
    });
    await loading.present();
  }

  private async dismissLoading() {
    await this.loadingController.dismiss();
  }

  public addChild() {
    const current = this._$children.getValue();
    const childValue = this.childForm.value;
    const newChild: IChildrenInfo = {
      a: childValue.ageGroup,
      t: childValue.toyType
    };

    current.push(newChild);
    this._$children.next(CheckInHelpers.sortChildren(current));
    this.childForm.reset();
  }

  public childColor = (value: string) => CheckInHelpers.childColor(value);

  public onAgeChange(value: any) {
    if (value === '0') {
      this.childForm.get('toyType').setValue('i');
    }
  }

  private async createRegistration(): Promise<IRegistration> {
    const registration = await this.checkInService.$manualRegistrationEdit.pipe(take(1)).toPromise() || new Registration();
    registration.zipCode = this._$zipCode.getValue();
    registration.children = this._$children.getValue();
    return registration;
  }

  private async invalidZipAlert() {
    const alert = await this.alertController.create({
      header: 'Invalid Zip Code',
      message: 'Must be 5 digits long',
      buttons: [
        {
          text: 'Ok',
        }
      ]
    });

    await alert.present();

    return await alert.onDidDismiss();
  }

}
