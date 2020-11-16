import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { LoadingController, AlertController } from '@ionic/angular';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, publishReplay, refCount } from 'rxjs/operators';
import { QuickRegistrationForms } from 'santashop-admin/src/app/shared/forms/quick-registration';
import { IChildrenInfo, IError } from 'santashop-core/src/public-api';

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPage implements OnDestroy {

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
    const newChild = this.customerForm.value as IChildrenInfo;
    current.push(newChild);
    this._$children.next(current);
  }

}
