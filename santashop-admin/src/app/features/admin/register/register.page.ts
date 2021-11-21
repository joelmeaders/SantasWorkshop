import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import { AgeGroup, IChild, IError, IRegistration, ToyType } from '@models/*';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { takeUntil, publishReplay, refCount, map, take, filter, switchMap } from 'rxjs/operators';
import { QuickRegistrationForms } from 'santashop-admin/src/app/forms/quick-registration';
import { CheckInHelpers } from 'santashop-admin/src/app/helpers/checkin-helpers';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';
import { RegistrationContextService } from '../../../services/registration-context.service';

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

  public readonly registrationEditSubscription = this.registrationContext.registration$.pipe(
    takeUntil(this.$destroy),
    filter(response => !!response),
    switchMap(registration => this.initRegistrationEdit(registration))
  ).subscribe();

  constructor(
    private readonly loadingController: LoadingController,
    private readonly registrationContext: RegistrationContextService,
    public readonly checkInService: CheckInService,
    private readonly alertController: AlertController
  ) { }

  public async initRegistrationEdit(registration?: IRegistration): Promise<void> {
    if (!registration) return;
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

    await this.presentLoading();
    const registration = await this.createRegistration();
    await this.checkInService.checkIn(registration, this._$isEdit.getValue());
    this.reset();
    this.registrationContext.reset();
    await this.dismissLoading();
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
    this._$children.next(new Array<IChild>());
    this.registrationContext.reset();
    this.customerForm.reset();
    this.childForm.reset();
    this._$isEdit.next(false);
  }

  public deleteChild(index: number) {
    const current = this._$children.getValue();
    current.splice(index, 1);
    this._$children.next(CheckInHelpers.sortChildren(current));
  }

  public setZip($event: any) {

    if (!$event.detail?.value || ($event.detail.value).toString().length !== 5) {
      return;
    }

    const value = Number.parseInt($event.detail.value);
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

  public onAgeChange($event: any) {
    const value = $event.detail.value as AgeGroup;
    console.log(value)
    if (value === AgeGroup.age02) {
      this.childForm.get('toyType')?.setValue(ToyType.infant);
    }
  }

  private async createRegistration(): Promise<IRegistration> {
    const registration = await this.registrationContext.registration$.pipe(take(1)).toPromise()
      ?? {} as IRegistration;
    registration.zipCode = this._$zipCode.getValue();
    const children = CheckInHelpers.sortChildren(this._$children.getValue());
    registration.children = children as any[] as IChild[];
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

    return alert.onDidDismiss();
  }

}
