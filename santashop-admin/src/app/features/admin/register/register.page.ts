import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { LoadingController } from '@ionic/angular';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { takeUntil, publishReplay, refCount, map } from 'rxjs/operators';
import { QuickRegistrationForms } from 'santashop-admin/src/app/forms/quick-registration';
import { CheckInHelpers } from 'santashop-admin/src/app/helpers/registration-helpers';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';
import { IChildrenInfo, IError, Registration } from 'santashop-core/src/public-api';

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

  constructor(
    private readonly loadingController: LoadingController,
    private readonly checkInService: CheckInService
  ) { }

  public async completeRegistration() {
    this.presentLoading();
    await this.checkInService.saveCheckIn(this.createRegistration());
    this.reset();
    this.dismissLoading();
    await this.checkInService.checkinCompleteAlert();
  }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  private reset(): void {
    this._$zipCode.next(undefined);
    this._$children.next(new Array<IChildrenInfo>());
    this.checkInService.reset();
    this.customerForm.reset();
    this.childForm.reset();
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
      this.childForm.get('toyType').setValue('i')
    }
  }

  private createRegistration(): Registration {
    const registration = new Registration();
    registration.zipCode = this._$zipCode.getValue();
    registration.children = this._$children.getValue();
    return registration;
  }

}
