import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { map, publishReplay, refCount, takeUntil } from 'rxjs/operators';
import { RegistrationSearchForm } from 'santashop-admin/src/app/forms/registration-search';
import { RegistrationSearch } from 'santashop-admin/src/app/models/registration-search.model';
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

  public readonly $searchValid = this.searchService.$searchStateValid.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  public readonly $searchResults = this.searchService.$searchResults.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly searchService: RegistrationSearchService,
  ) { }

  public ngOnDestroy(): void {
    this.$destroy.next();
  }

  public search() {
    this.searchService.search();
  }

  public onInputChange(): void {
    const model = this.formToSearchModel();
    this.searchService.setSearchState(model);
  }

  private formToSearchModel(): RegistrationSearch {
    return {
      ...this.form.value
    } as RegistrationSearch;
  }
}
