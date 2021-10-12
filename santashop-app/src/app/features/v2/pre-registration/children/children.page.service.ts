import { Injectable, OnDestroy } from '@angular/core';
import { ChildValidationError, ChildValidationService, IChild, PreRegistrationService } from '@core/*';
import { AlertController } from '@ionic/angular';
import { OverlayEventDetail } from '@ionic/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay, take } from 'rxjs/operators';

@Injectable()
export class ChildrenPageService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly children$: Observable<IChild[] | undefined> =
    this.preRegistrationService.children$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  public readonly childCount$: Observable<number> =
    this.preRegistrationService.childCount$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  constructor(
    private readonly preRegistrationService: PreRegistrationService,
    private readonly childValidationService: ChildValidationService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public async addChild(child: IChild): Promise<void> {

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    try {
      const validatedChild = this.childValidationService.validateChild(child);
      children?.push(validatedChild);
      return this.updateRegistration(children);
    } 
    catch (ex) {
      const error = ex as ChildValidationError;
      let message = "";

      if (error.code === "invalid_age") {
        message = this.translateService.instant('ADD_CHILDREN.INVALID_AGE');
      }
      else if (error.code === "invalid_firstname") {
        message = this.translateService.instant('ADD_CHILDREN.INVALID_FIRSTNAME');
      }
      else if (error.code === "invalid_lastname") {
        message = this.translateService.instant('ADD_CHILDREN.INVALID_LASTNAME');
      }
      
      await this.invalidEntryAlert(message);
      return Promise.reject(ex);
    }
  }

  public async removeChild(childToRemove: IChild): Promise<void> {

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    const updatedChildren = children?.filter(
      child => child.id !== childToRemove.id);

    return this.updateRegistration(updatedChildren);
  }

  private async updateRegistration(children?: IChild[]) {

    const registration = 
      await this.preRegistrationService.userRegistration$.pipe(take(1)).toPromise();
    
    registration.children = children;
    
    // TODO: Error handling
    const storeRegistration = 
      this.preRegistrationService.saveRegistration(registration)
        .pipe(take(1)).toPromise();

    try {
      await storeRegistration;
    } 
    catch (error) 
    { 
      // TODO: Do something
    }
  }

  private async invalidEntryAlert(message: string): Promise<OverlayEventDetail<any>> {
    const alert = await this.alertController.create({
      header: this.translateService.instant('ADD_CHILDREN.ERROR_HEADER'),
      message: message,
      buttons: [
        { text: this.translateService.instant('COMMON.OK')}
      ]
    });

    await alert.present();
    return alert.onDidDismiss();
  }
}
