import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	BehaviorSubject,
	delay,
	filter,
	map,
	Observable,
	of,
	race,
	shareReplay,
	Subject,
	switchMap,
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

	private readonly searchTrigger = new Subject<Date>();
	public readonly searchInput$ = this.searchService.searchResults$;

	private readonly search$: Observable<RegistrationSearchIndex[]> =
		this.searchService.searchResults$.pipe(
			filter((query) => query !== null),
			switchMap((query) => query!),
			switchMap((results) =>
				this.sortBy$.pipe(map((sortFn) => results?.sort(sortFn) ?? []))
			)
		);

	private readonly timeout$ = of(undefined).pipe(delay(5000));

	public readonly searchResults$ = this.searchTrigger.pipe(
		switchMap(() => race([this.search$, this.timeout$]))
	);

	constructor(private readonly searchService: SearchService) {}

	public async ionViewWillEnter(): Promise<void> {
		this.searchTrigger.next(new Date());
	}

	public ionViewWillLeave(): void {
		this.searchService.reset();
	}

	public setSortType(sort: SortFnType): void {
		this.sortBy.next(sort);
	}

	public reset(): void {
		this.searchService.reset();
	}
}
