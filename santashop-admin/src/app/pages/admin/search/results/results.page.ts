import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
	catchError,
	delay,
	filter,
	map,
	Observable,
	of,
	race,
	startWith,
	switchMap,
} from 'rxjs';
import { RegistrationSearchIndex } from '@santashop/models';
import { SearchService } from '../search.service';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { RouterLink } from '@angular/router';

import { addIcons } from 'ionicons';
import { backspaceOutline } from 'ionicons/icons';
import {
	IonRouterLink,
	IonContent,
	IonButton,
	IonSpinner,
	IonCardSubtitle,
	IonCardHeader,
	IonCardTitle,
	IonChip,
	IonList,
	IonItem,
	IonLabel,
	IonIcon,
} from '@ionic/angular/standalone';

declare type SortFnType = (
	a: RegistrationSearchIndex,
	b: RegistrationSearchIndex,
) => number;

const compareSearchValues = (
	left: string | undefined,
	right: string | undefined,
): number => (left ?? '').localeCompare(right ?? '');

@Component({
	selector: 'admin-results',
	templateUrl: './results.page.html',
	styleUrls: ['./results.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		HeaderComponent,
		RouterLink,
		IonRouterLink,
		IonContent,
		IonButton,
		IonSpinner,
		IonCardSubtitle,
		IonCardHeader,
		IonCardTitle,
		IonChip,
		IonList,
		IonItem,
		IonLabel,
		IonIcon,
	],
})
export class ResultsPage {
	private readonly searchService = inject(SearchService);

	public readonly sortLast = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex,
	): number =>
		compareSearchValues(a.lastName, b.lastName) ||
		compareSearchValues(a.firstName, b.firstName) ||
		compareSearchValues(a.zip, b.zip);

	public readonly sortFirst = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex,
	): number =>
		compareSearchValues(a.firstName, b.firstName) ||
		compareSearchValues(a.lastName, b.lastName) ||
		compareSearchValues(a.zip, b.zip);

	public readonly sortEmail = (
		a: RegistrationSearchIndex,
		b: RegistrationSearchIndex,
	): number =>
		compareSearchValues(a.emailAddress, b.emailAddress) ||
		compareSearchValues(a.lastName, b.lastName) ||
		compareSearchValues(a.firstName, b.firstName);

	public readonly sortBy = signal<SortFnType>(this.sortLast);
	private readonly sortBy$ = toObservable(this.sortBy);
	public readonly searchInput = toSignal(this.searchService.searchResults$, {
		initialValue: null,
	});
	private readonly refreshVersion = signal<number | undefined>(undefined);

	private readonly search$: Observable<
		RegistrationSearchIndex[] | undefined
	> = this.searchService.searchResults$.pipe(
		filter(
			(query): query is Observable<RegistrationSearchIndex[]> =>
				query !== null,
		),
		switchMap((query) => query),
			switchMap((results) =>
				this.sortBy$.pipe(
					map((sortFn) => results?.slice().sort(sortFn) ?? []),
				),
			),
		catchError(() => of(undefined)),
	);

	private readonly timeout$ = of(undefined).pipe(delay(5000));

	public readonly searchResults$ = toObservable(this.refreshVersion).pipe(
		filter((version): version is number => version !== undefined),
		switchMap(() =>
			race([this.search$, this.timeout$]).pipe(startWith(null)),
		),
	);
	public readonly searchResults = toSignal(this.searchResults$, {
		initialValue: undefined,
	});

	constructor() {
		addIcons({ backspaceOutline });
	}

	public async ionViewWillEnter(): Promise<void> {
		this.refresh();
	}

	public refresh(): void {
		this.refreshVersion.update((version) => (version ?? -1) + 1);
	}

	public ionViewWillLeave(): void {
		this.searchService.reset();
	}

	public setSortType(sort: SortFnType): void {
		this.sortBy.set(sort);
	}

	public reset(): void {
		this.searchService.reset();
	}
}
