import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { delay, publishReplay, refCount, takeUntil, tap } from 'rxjs/operators';
import { QrModalComponent } from 'santashop-admin/src/app/components/qr-modal/qr-modal.component';
import { RegistrationSearchForm } from 'santashop-admin/src/app/forms/registration-search';
import { RegistrationSearch } from 'santashop-admin/src/app/models/registration-search.model';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';
import { RegistrationSearchService } from 'santashop-admin/src/app/services/registration-search.service';

@Component({
  selector: 'app-search',
  templateUrl: 'search.page.html',
  styleUrls: ['search.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchPage implements OnDestroy {

  private readonly $destroy = new Subject<void>();

  public readonly form: FormGroup = RegistrationSearchForm.registrationSearchForm();

  private readonly _$loading = new BehaviorSubject<boolean>(false);
  public readonly $loading = this._$loading.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $searchValid = this.searchService.$searchStateValid.pipe(
    takeUntil(this.$destroy)
  );

  public readonly $searchResults = this.searchService.$searchResults.pipe(
    takeUntil(this.$destroy),
    tap(() => this._$loading.next(false)),
    tap(() => this.refresh()),
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly searchService: RegistrationSearchService,
    private readonly checkInService: CheckInService,
    private readonly modalController: ModalController,
    private readonly cd: ChangeDetectorRef
  ) { }

  public ngOnDestroy(): void {
    this.$destroy.next();
  }
  
  public async refresh() {
    of().pipe(delay(1000)).toPromise().then(() => {
      this.cd.detectChanges();
    });
  }

  public async reset() {
    this.searchService.resetSearchState();
    this.form.get('registrationCode').setValue(undefined);
    this.form.get('firstName').setValue(undefined);
    this.form.get('lastName').setValue(undefined);
  }

  public search() {
    this._$loading.next(true);
    this.searchService.search();
  }

  public onInputChange(): void {
    const model = this.formToSearchModel();
    this.searchService.setSearchState(model);
  }

  public async onSelect(code: string) {
    this.checkInService.setRegistrationCode(code);
    await this.openModal();
  }

  private formToSearchModel(): RegistrationSearch {
    return {
      ...this.form.value
    } as RegistrationSearch;
  }

  private async openModal() {

    const modal = await this.modalController.create({
      component: QrModalComponent,
      cssClass: 'modal-lg',
      backdropDismiss: false
    });

    await modal.present();
  }
}
