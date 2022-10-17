import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { RegistrationSearchIndex } from '../../../../../../santashop-models/src/public-api';
import { BehaviorSubject, Subject } from 'rxjs';
import { publishReplay, refCount, take, takeUntil, tap } from 'rxjs/operators';
import { RegistrationSearchForm } from 'santashop-admin/src/app/forms/registration-search';
import { IRegistrationSearch } from 'santashop-admin/src/app/models/registration-search.model';
import { RegistrationSearchService } from 'santashop-admin/src/app/services/registration-search.service';
import { RegistrationContextService } from '../../../services/registration-context.service';

@Component({
	selector: 'app-search',
	templateUrl: 'search.page.html',
	styleUrls: ['search.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage implements OnDestroy {
	private readonly $destroy = new Subject<void>();

	public readonly form: FormGroup =
		RegistrationSearchForm.registrationSearchForm();

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
		publishReplay(1),
		refCount()
	);

	constructor(
		private readonly searchService: RegistrationSearchService,
		private readonly registrationContext: RegistrationContextService
	) {}

	public ngOnDestroy(): void {
		this.$destroy.next();
	}

	public async reset(): Promise<void> {
		this.searchService.resetSearchState();
		this.form.get('registrationCode')?.setValue(undefined);
		this.form.get('firstName')?.setValue(undefined);
		this.form.get('lastName')?.setValue(undefined);
	}

	public search(): void {
		this._$loading.next(true);
		this.searchService.search();
	}

	public onInputChange(): void {
		const model = this.formToSearchModel();
		this.searchService.setSearchState(model);
	}

	public async onSelect(index: RegistrationSearchIndex) {
		const registration = await this.searchService
			.getRegistrationByUid$(index.customerId)
			.pipe(take(1))
			.toPromise();

		if (registration) {
			this.registrationContext.setCurrentRegistration(registration);
		} else {
			// TODO: Error handling
		}
	}

	private formToSearchModel(): IRegistrationSearch {
		return {
			...this.form.value,
		} as IRegistrationSearch;
	}
}
