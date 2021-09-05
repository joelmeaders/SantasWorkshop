import { ChangeDetectionStrategy, Component, Inject, OnDestroy, ViewEncapsulation } from '@angular/core';
import { AgeGroup, getAgeFromDate, IChild, MAX_BIRTHDATE, MIN_BIRTHDATE, MOBILE_EVENT, PROGRAM_YEAR, ToyType, yyyymmddToLocalDate } from '@core/*';
import { AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import { newChildForm } from './child.form';

@Component({
  selector: 'app-child-modal',
  templateUrl: './child-modal.component.html',
  styleUrls: ['./child-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class ChildModalComponent implements OnDestroy {

  private readonly destroy$ = new Subject<void>();
  public readonly form = newChildForm(this.programYear);

  public readonly minBirthDate = MIN_BIRTHDATE().toISOString();
  public readonly maxBirthDate = MAX_BIRTHDATE().toISOString();

  private readonly _$isInfant = new BehaviorSubject<boolean>(false);
  public readonly $isInfant = this._$isInfant.pipe(takeUntil(this.destroy$), shareReplay(1));

  constructor(
    @Inject(PROGRAM_YEAR) private readonly programYear: number,
    @Inject(MOBILE_EVENT) public readonly mobileEvent: boolean,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public cancel() {
    // this.analyticsService.logEvent('child_add_cancel');
    this.modalController.dismiss();
  }

  public dismiss() {
    const child: IChild = {
      ...this.form.value
    };

    // Fixes yyyy-mm-dd format
    const yyyymmdd: any = this.form.controls.dateOfBirth.value;
    child.dateOfBirth = yyyymmddToLocalDate(yyyymmdd)
    this.modalController.dismiss(child);
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
    const control = this.form.controls['ageGroup'];

    if (ageInYears >= 0 && ageInYears < 3) {
      this.setInfant(true);
      return;
    } else if (ageInYears >= 3 && ageInYears < 6) {
      control.setValue(AgeGroup.age35);
    } else if (ageInYears >= 6 && ageInYears < 9) {
      control.setValue(AgeGroup.age68);
    } else if (ageInYears >= 9 && ageInYears < 12) {
      control.setValue(AgeGroup.age911);
    } else {
      await this.childTooOldAlert().then(() => this.modalController.dismiss());
    }

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
}
