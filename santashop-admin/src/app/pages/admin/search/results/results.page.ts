import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	BehaviorSubject,
	combineLatest,
	map,
	Observable,
	shareReplay,
} from 'rxjs';
import { RegistrationSearchIndex } from '@models/';
import { SearchService } from '../search.service';

declare type SortFnType = (
	a: RegistrationSearchIndex,
	b: RegistrationSearchIndex
) => number;

@Component({
	selector: 'admin-results',
	templateUrl: './results.page.html',
	styleUrls: ['./results.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPage {
	public readonly sortLast = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex
	): number =>
		a.lastName.localeCompare(b.lastName) ||
		a.firstName.localeCompare(b.firstName) ||
		a.zip.localeCompare(b.zip);

	public readonly sortFirst = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex
	): number =>
		a.lastName.localeCompare(b.firstName) ||
		a.firstName.localeCompare(b.lastName) ||
		a.zip.localeCompare(b.zip);

	public readonly sortEmail = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex
	): number => a.lastName.localeCompare(b.emailAddress);

	private readonly sortBy = new BehaviorSubject<SortFnType>(this.sortLast);
	protected sortBy$ = this.sortBy.asObservable().pipe(shareReplay(1));

	protected readonly searchResults$: Observable<RegistrationSearchIndex[]> =
		combineLatest({
			sortFn: this.sortBy$,
			results: this.searchService.searchResults$ ?? [],
		}).pipe(map((data) => data.results.sort(data.sortFn)));

	constructor(private readonly searchService: SearchService) {}

	public setSortType(sort: SortFnType): void {
		this.sortBy.next(sort);
	}

	public reset(): void {
		this.searchService.reset();
	}
}
