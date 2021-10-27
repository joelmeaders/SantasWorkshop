import { ChangeDetectionStrategy, Component, Inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AgeGroup, ChildValidationError, ChildValidationService, getAgeFromDate, IChild, MAX_BIRTHDATE, MIN_BIRTHDATE, MOBILE_EVENT, PreRegistrationService, PROGRAM_YEAR, ToyType, yyyymmddToLocalDate } from '@core/*';
import { AlertController } from '@ionic/angular';
import { OverlayEventDetail } from '@ionic/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay, take } from 'rxjs/operators';
import { newChildForm } from './child.form';

@Component({
  selector: 'app-add-child',
  templateUrl: './add-child.page.html',
  styleUrls: ['./add-child.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChildValidationService]
})
export class AddChildPage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly children$: Observable<IChild[] | undefined> =
    this.preRegistrationService.children$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );
  public readonly form = newChildForm(this.programYear);

  public readonly minBirthDate = MIN_BIRTHDATE().toISOString();
  public readonly maxBirthDate = MAX_BIRTHDATE().toISOString();

  private readonly _$isInfant = new BehaviorSubject<boolean>(false);
  public readonly isInfant$ = this._$isInfant.pipe(takeUntil(this.destroy$), shareReplay(1));

  constructor(
    @Inject(PROGRAM_YEAR) private readonly programYear: number,
    @Inject(MOBILE_EVENT) public readonly mobileEvent: boolean,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService,
    private readonly preRegistrationService: PreRegistrationService,
    private readonly childValidationService: ChildValidationService,
    private readonly router: Router

  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public dismiss() {
    const child: IChild = {
      ...this.form.value
    };

    // Fixes yyyy-mm-dd format
    const yyyymmdd: any = this.form.controls.dateOfBirth.value;
    child.dateOfBirth = yyyymmddToLocalDate(yyyymmdd)
  }

  public setInfant(value: boolean) {

    this._$isInfant.next(true);

    const toyTypeControl = this.form.controls['toyType'];
    const ageGroupControl = this.form.controls['ageGroup'];

    if (value) {
      toyTypeControl.setValue(ToyType.infant);
      ageGroupControl.setValue(AgeGroup.age02);
    }
  }

  public async birthdaySelected() {

    const yyyymmdd: any = this.form.controls.dateOfBirth.value;
    if (!yyyymmdd) return;
    
    if (!this.form.controls.dateOfBirth.valid)
      return;

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
      // TODO:
      await this.childTooOldAlert();
    }

    this.form.controls.ageGroup.setValue(ageGroup!);
    this._$isInfant.next(false);
  }

  private async childTooOldAlert() {
    const alert = await this.alertController.create({
      header: this.translateService.instant('ADDCHILD.TOO_OLD_1'),
      message: this.translateService.instant('REGISTRATION.ADD_CHILD_INSTRUCTIONS_2'),
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
      return;
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

    this.router.navigate(['pre-registration/children']);
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
