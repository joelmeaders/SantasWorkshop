import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { FormGroup } from '@angular/forms';
import { AlertController, ModalController } from '@ionic/angular';
import { differenceInDays } from 'date-fns';
import { BehaviorSubject, Subject } from 'rxjs';
import { shareReplay, takeUntil } from 'rxjs/operators';
import { ChildProfile } from 'santashop-core/src/public-api';
import { ChildProfileForm } from '../../forms/child-profile';

@Component({
  selector: 'app-create-child-modal',
  templateUrl: './create-child-modal.component.html',
  styleUrls: ['./create-child-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateChildModalComponent implements OnInit {
  @Input() item: ChildProfile;

  private readonly $destroy = new Subject<void>();

  public form: FormGroup;
  public readonly formValidationMessages = ChildProfileForm.validationMessages();

  private readonly _$isInfant = new BehaviorSubject<boolean>(false);
  public readonly $isInfant = this._$isInfant.pipe(takeUntil(this.$destroy), shareReplay(1));

  constructor(
    private readonly modalController: ModalController,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly alertController: AlertController,
    private readonly analyticsService: AngularFireAnalytics
  ) {}

  public ngOnInit() {
    this.form = ChildProfileForm.form(this.item);

    if (this.item && this.isInfant()) {
      this.setInfant(true);
    }
  }

  public cancel() {
    let didAdd = false;

    if (!!this.item?.id) {
      didAdd = false;
    } else {
      didAdd = true;
    }
    this.analyticsService.logEvent(didAdd ? 'child_add_cancel' : 'child_edit_cancel');
    this.modalController.dismiss();
  }

  public returnChild() {
    const child: ChildProfile = {
      ...this.form.value,
    };

    this.modalController.dismiss(child);
  }

  private aroundEventDate(): Date {
    const year = new Date().getUTCFullYear();
    // Give it some extra days to prevent cutting a child
    // off when their birthday is right on the edge
    const estimatedDate = '12/18';
    return new Date(`${estimatedDate}/${year}`);
  }

  private isInfant(): boolean {

    const dateOfBirth = this.form.controls['dateOfBirth'].value;

    if (!dateOfBirth?.length) {
      return false;
    }

    const ageInYears = differenceInDays(this.aroundEventDate(), new Date(dateOfBirth)) / 365;
    const isInfant = ageInYears <= 3.0;
    return isInfant;
  }

  public setInfant(value: boolean) {

    this.changeDetector.markForCheck();

    this._$isInfant.next(true);

    const toyTypeControl = this.form.controls['toyType'];
    const ageGroupControl = this.form.controls['ageGroup'];

    if (value) {
      toyTypeControl.setValue('infant');
      ageGroupControl.setValue('0-2');
    }

    this.changeDetector.detectChanges();
  }

  public async birthdaySelected(date: any) {
    if (!date?.detail?.value) {
      return;
    }

    const ageInYears = differenceInDays(this.aroundEventDate(), new Date(date?.detail?.value)) / 365;

    const control = this.form.controls['ageGroup'];

    if (ageInYears >= 0 && ageInYears < 3) {
      this.setInfant(true);
      return;
    } else if (ageInYears >= 3 && ageInYears < 6) {
      control.setValue('3-5');
    } else if (ageInYears >= 6 && ageInYears < 9) {
      control.setValue('6-8');
    } else if (ageInYears >= 9 && ageInYears < 12) {
      control.setValue('9-11');
    } else {
      await this.tooOld().then(() => this.modalController.dismiss());
    }

    this._$isInfant.next(false);
  }

  private async tooOld() {
    const alert = await this.alertController.create({
      header: `We're sorry`,
      message: `We only have toys for children ages 11 and under`,
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
