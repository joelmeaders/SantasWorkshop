import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { IChild, IError, IRegistration, ToyType } from '@models/*';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { takeUntil, publishReplay, refCount, map } from 'rxjs/operators';
import { QuickRegistrationForms } from 'santashop-admin/src/app/forms/quick-registration';
import { CheckInHelpers } from 'santashop-admin/src/app/helpers/checkin-helpers';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPage implements OnDestroy {

  public readonly customerForm: FormGroup = QuickRegistrationForms.customerForm(undefined);
  public readonly customerFormValidationMessages = QuickRegistrationForms.customerValidationMessages();

  public readonly childForm: FormGroup = QuickRegistrationForms.childForm(undefined);
  public readonly childFormValidationMessages = QuickRegistrationForms.childValidationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new BehaviorSubject<boolean>(false);
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly _$zipCode = new BehaviorSubject<number | undefined>(undefined);
  public readonly $zipCode = this._$zipCode.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  private readonly _$children = new BehaviorSubject<Partial<IChild>[]>([]);
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

  // public readonly registrationEditSubscription = this.checkInService.$manualRegistrationEdit.pipe(
  //   takeUntil(this.$destroy),
  //   filter(response => !!response),
  //   switchMap(registration => this.initRegistrationEdit(registration!))
  // ).subscribe();

  constructor(
    private readonly loadingController: LoadingController,
    public readonly checkInService: CheckInService,
    private readonly alertController: AlertController
  ) { }

  public async initRegistrationEdit(registration: IRegistration): Promise<void> {
    this.setZip(registration.zipCode!);
    this.customerForm.get('zipCode')?.setValue(registration.zipCode);
    this._$children.next(registration.children!);
    this._$isEdit.next(true);
  }

  public async completeRegistration() {

    if (this._$zipCode.getValue()?.toString().length !== 5) {
      await this.invalidZipAlert();
      return;
    }

    // await this.presentLoading();
    // const registration = await this.createRegistration();
    // await this.checkInService.saveCheckIn(registration, this._$isEdit.getValue());
    // this.reset();
    // await this.dismissLoading();
    // await this.checkInService.checkinCompleteAlert();
    // this.checkInService.reset();
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
    // this._$zipCode.next(undefined);
    // this._$children.next(new Array<IChild>());
    // this.checkInService.reset();
    // this.customerForm.reset();
    // this.childForm.reset();
    // this._$isEdit.next(false);
  }

  public deleteChild(index: number) {
    const current = this._$children.getValue();
    current.splice(index, 1);
    this._$children.next(CheckInHelpers.sortChildren(current));
  }

  public setZip(value: any) {
    // TODO:
    console.log(value)
    this._$zipCode.next(value);
  }

  public async presentLoading() {
    const loading = await this.loadingController.create({
      message: 'Saving registration...',
      translucent: true,
      backdropDismiss: true
    });
    await loading.present();
  }

  public async dismissLoading() {
    await this.loadingController.dismiss();
  }

  public addChild() {
    const current = this._$children.getValue();
    const childValue = this.childForm.value as IChild;
    const newChild: Partial<IChild> = {
      ageGroup: childValue.ageGroup,
      toyType: childValue.toyType
    };

    current.push(newChild);
    this._$children.next(CheckInHelpers.sortChildren(current));
    this.childForm.reset();
  }

  public childColor = (value: ToyType) => CheckInHelpers.childColor(value);

  public onAgeChange(value: any) {
    // TODO:
    console.log(value)
    if (value === '0') {
      this.childForm.get('toyType')?.setValue(ToyType.infant);
    }
  }

  // private async createRegistration(): Promise<IRegistration> {
  //   const registration = await this.checkInService.$manualRegistrationEdit.pipe(take(1)).toPromise() || {} as IRegistration;
  //   registration.zipCode = this._$zipCode.getValue();
  //   registration.children = this._$children.getValue() as any[] as IChild[];
  //   return registration;
  // }

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
