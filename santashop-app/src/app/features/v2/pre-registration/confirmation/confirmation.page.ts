import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/compat/analytics';
import { Router } from '@angular/router';
import { ErrorHandlerService, PreRegistrationService } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { IError } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-confirmation',
  templateUrl: './confirmation.page.html',
  styleUrls: ['./confirmation.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationPage {

  public readonly isRegistrationComplete$ = this.viewService.registrationComplete$;

  constructor(
    public readonly viewService: PreRegistrationService,
    private readonly loadingController: LoadingController,
    private readonly alertController: AlertController,
    private readonly router: Router,
    private readonly errorHandler: ErrorHandlerService,
    private readonly translateService: TranslateService,
    private readonly analytics: AngularFireAnalytics
    ) { }

    public async undoRegistration(): Promise<void> {

      const alert = await this.alertController.create({
        header: this.translateService.instant('CONFIRMATION.ARE_YOU_SURE'),
        message: this.translateService.instant('CONFIRMATION.CONFIRM_CHANGE_MSG'),
        buttons: [
          {
            text: this.translateService.instant('COMMON.GO_BACK'),
            role: 'cancel',
            cssClass: 'confirm-delete-button'
          },
          {
            text: this.translateService.instant('COMMON.CONFIRM'),
            role: 'confirm',
          }
        ],
      });
  
      await alert.present();
      const shouldContinue = await alert.onDidDismiss();
      
      if (shouldContinue.role !== 'confirm')
        return;

      const loader = await this.loadingController.create(
        { message: 'Deleting registration...' });
  
      await loader.present();
  
      try {
        await this.analytics.logEvent('delete_registration');
        await this.viewService.undoRegistration().pipe(take(1)).toPromise();
      }
      catch (error) {
        await this.errorHandler.handleError(error as IError);
      }
      finally {
        await loader.dismiss();
        this.router.navigate(['/pre-registration/overview']);
      }
    }
}
