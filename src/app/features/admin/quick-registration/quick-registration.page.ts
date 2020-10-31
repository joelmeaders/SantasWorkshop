import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { IError } from '@app/core/models/base/i-errors';
import { ChildProfile } from '@app/core/models/child-profile.model';
import { IChildrenInfo } from '@app/core/models/registration.model';
import { UserRegistrationService } from '@app/core/services/user-registration.service';
import { QuickRegistrationForms } from '@app/shared/forms/quick-registration';
import { SignUpForm } from '@app/shared/forms/sign-up';
import { AlertController, LoadingController } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil, publishReplay, refCount, shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-quick-registration',
  templateUrl: './quick-registration.page.html',
  styleUrls: ['./quick-registration.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickRegistrationPage implements OnDestroy {

  public readonly customerForm: FormGroup = QuickRegistrationForms.customerForm(null);
  public readonly customerFormValidationMessages = QuickRegistrationForms.customerValidationMessages();

  public readonly $error = new Subject<IError>();
  private readonly $destroy = new Subject<void>();

  private readonly _$loading = new Subject<boolean>();
  public readonly $loading = this._$loading.pipe(
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

  constructor(
    private readonly userRegistrationService: UserRegistrationService,
    private readonly loadingController: LoadingController,
    private readonly alertController: AlertController
  ) { }

  public async ngOnDestroy() {
    this.$destroy.next();
    try {
      await this.loadingController.dismiss();
    } catch {
      // Do nothing
    }
  }

  private async presentLoading() {
    const loading = await this.loadingController.create({
      duration: 3000,
      message: 'Saving registration...',
      translucent: true,
      backdropDismiss: true
    });
    await loading.present();
  }

  private async destroyLoading() {
    await this.loadingController.dismiss();
  }

  private async handleError(error: IError) {

    const alert = await this.alertController.create({
      header: 'Error',
      subHeader: error.code,
      message: error.message,
      buttons: ['Ok']
    });

    await alert.present();

  }

  public addChild() {
    const current = this._$children.getValue();
    const newChild = this.customerForm.value as ChildProfile;

    const childInfo: IChildrenInfo = {
      n: null,
      t: newChild.toyType,
      a: newChild.ageGroup
    };

    current.push(childInfo);

    this._$children.next(current);
  }

}
