import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Router } from '@angular/router';
import { getAgeFromDate, MAX_BIRTHDATE, PROGRAM_YEAR, yyyymmddToLocalDate } from '@core/*';
import { AlertController } from '@ionic/angular';
import { IChild, ChildValidationError, ToyType, AgeGroup } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay, take } from 'rxjs/operators';
import { ChildValidationService, PreRegistrationService } from '../../../../../core';
import { newChildForm } from './child.form';

@Injectable()
export class AddChildPageService implements OnDestroy {

  public readonly destroy$ = new Subject<void>();
  public readonly form = newChildForm(this.programYear);

  private readonly _isInfant$ = new BehaviorSubject<boolean>(false);
  public readonly isInfant$ = this._isInfant$.pipe(
    takeUntil(this.destroy$), 
    shareReplay(1)
  );

  private readonly _isEdit$ = new BehaviorSubject<boolean>(false);
  public readonly isEdit$ = this._isEdit$.pipe(
    takeUntil(this.destroy$), 
    shareReplay(1)
  );

  public readonly children$: Observable<IChild[] | undefined> =
    this.preRegistrationService.children$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );


  constructor(
    @Inject(PROGRAM_YEAR) private readonly programYear: number,
    private readonly preRegistrationService: PreRegistrationService,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService,
    private readonly childValidationService: ChildValidationService,
    private readonly router: Router,
    private readonly analytics: Analytics
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  

  public async setChildToEdit(id: number) {

    await logEvent(this.analytics, 'view_child', { id: id });

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    if (!children || children.length < 1) {
      return;
    }
    
    const child = children.filter(c => c.id == id)[0];

    if (!child) {
      return;
    }

    this.form.patchValue({...child});

    // TODO: Improve this horrible date stuff at some point.
    // I opted not to use a 3rd party library this time, and
    // JS dates don't play well with Firebase Timestamps.
    const year = child.dateOfBirth.getFullYear();
    var month = (child.dateOfBirth.getMonth()+1).toString();
    var day = child.dateOfBirth.getDate().toString();

    month = month.length === 2 ? month : `0${month}`;
    day = day.length === 2 ? day : `0${day}`;

    // Set birth date
    const date = `${year}-${month}-${day}`
    console.log(date)
    this.form.controls.dateOfBirth.setValue(date as any as Date);
    
    await this.birthdaySelected();
    this._isEdit$.next(true);

  }

  public async editChild() {

    const updatedChild = this.form.value as IChild;
    updatedChild.dateOfBirth = yyyymmddToLocalDate(updatedChild.dateOfBirth as any);

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    try {
      const validatedChild = this.childValidationService.validateChild(updatedChild);
      delete validatedChild.error;
      const updatedChildren = children?.filter(child => child.id !== validatedChild.id);
      updatedChildren?.push(validatedChild);
      await logEvent(this.analytics, 'edit_child', { id: updatedChild.id });
      return this.updateRegistration(updatedChildren);
    } 
    catch (ex) {
      const error = ex as ChildValidationError;
      let message = "";

      if (error.code === "invalid_age") {
        message = this.translateService.instant('ADDCHILD.INVALID_AGE');
        await logEvent(this.analytics, 'edit_child_error', { id: updatedChild, error: error.code });
      }
      else if (error.code === "invalid_firstname") {
        message = this.translateService.instant('ADD_CHILDREN.INVALID_FIRSTNAME');
        await logEvent(this.analytics, 'edit_child_error', { id: updatedChild, error: error.code });
      }
      else if (error.code === "invalid_lastname") {
        message = this.translateService.instant('ADD_CHILDREN.INVALID_LASTNAME');
        await logEvent(this.analytics, 'edit_child_error', { id: updatedChild, error: error.code });
      }
      
      await this.invalidEntryAlert(message);
      return;
    }
  }

  public setInfant(value: boolean) {

    this._isInfant$.next(true);

    const toyTypeControl = this.form.controls['toyType'];
    const ageGroupControl = this.form.controls['ageGroup'];

    if (value) {
      toyTypeControl.setValue(ToyType.infant);
      ageGroupControl.setValue(AgeGroup.age02);
    }
  }

  public async birthdaySelected() {

    console.log(this.form.controls.dateOfBirth.value)

    const yyyymmdd: any = this.form.controls.dateOfBirth.value;
    if (!yyyymmdd) return;
    
    if (!this.form.controls.dateOfBirth.valid) {
      return;
    }

    const dateOfBirth = yyyymmddToLocalDate(yyyymmdd);
    const ageInYears = getAgeFromDate(dateOfBirth, MAX_BIRTHDATE());
    var ageGroup: AgeGroup | undefined = undefined;

    if (ageInYears >= 0 && ageInYears < 3) {
      this.setInfant(true);
      return;
    } else if (ageInYears >= 3 && ageInYears < 6) {
      ageGroup = AgeGroup.age35;
    } else if (ageInYears >= 6 && ageInYears < 9) {
      ageGroup = AgeGroup.age68;
    } else if (ageInYears >= 9 && ageInYears < 12) {
      ageGroup = AgeGroup.age911;
    } else {
      await logEvent(this.analytics, 'child_invalid_age_entry', { age: ageInYears });
      await this.childTooOldAlert();
      this.form.controls.dateOfBirth.reset();
    }

    this.form.controls.ageGroup.setValue(ageGroup!);
    this._isInfant$.next(false);
  }

  private async childTooOldAlert() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('ADDCHILD.TOO_OLD_1'),
      message: this.translateService.instant('ADDCHILD.INVALID_AGE'),
      buttons: [
        {
          text: 'Ok',
        },
      ],
    });

    await alert.present();
    return alert.onDidDismiss();
  }

  public async addChild(): Promise<void> {

    const child = this.form.value as IChild;
    child.dateOfBirth = yyyymmddToLocalDate(child.dateOfBirth as any);

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    try {
      const validatedChild = this.childValidationService.validateChild(child);
      children?.push(validatedChild);
      await logEvent(this.analytics, 'add_child');
      return this.updateRegistration(children);
    } 
    catch (ex) {
      const error = ex as ChildValidationError;
      let message = "";

      if (error.code === "invalid_age") {
        message = this.translateService.instant('ADDCHILD.INVALID_AGE');
        await logEvent(this.analytics, 'add_child_error', { id: child, error: error.code });
      }
      else if (error.code === "invalid_firstname") {
        message = this.translateService.instant('ADDCHILD.INVALID_FIRSTNAME');
        await logEvent(this.analytics, 'add_child_error', { id: child, error: error.code });
      }
      else if (error.code === "invalid_lastname") {
        message = this.translateService.instant('ADDCHILD.INVALID_LASTNAME');
        await logEvent(this.analytics, 'add_child_error', { id: child, error: error.code });
      }
      
      await this.invalidEntryAlert(message);
      return;
    }
  }

  public async removeChild(childToRemove: IChild): Promise<void> {

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    const updatedChildren = children?.filter(
      child => child.id !== childToRemove.id);

    await logEvent(this.analytics, 'remove_child', { id: childToRemove.id });
    return this.updateRegistration(updatedChildren);
  }

  private async updateRegistration(children?: IChild[]) {

    const registration = 
      await firstValueFrom(this.preRegistrationService.userRegistration$);
    
    registration.children = children;
    
    // TODO: Error handling
    const storeRegistration = 
      firstValueFrom(this.preRegistrationService.saveRegistration(registration));

    try {
      await storeRegistration;
    } 
    catch (error) 
    { 
      // TODO: Do something
    }

    this.router.navigate(['pre-registration/children']);
  }

  private async invalidEntryAlert(message: string): Promise<any> {
    const alert = await this.alertController.create({
      header: this.translateService.instant('ADDCHILD.TOO_OLD_1'),
      message: message,
      buttons: [
        { text: this.translateService.instant('COMMON.OK')}
      ]
    });

    await alert.present();
    return alert.onDidDismiss();
  }
}
