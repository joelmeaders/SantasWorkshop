import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RegistrationSearchService } from 'santashop-admin/src/app/services/registration-search.service';

@Component({
  selector: 'app-search',
  templateUrl: 'search.page.html',
  styleUrls: ['search.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchPage {

  constructor(
    private readonly searchService: RegistrationSearchService
  ) { }
}
