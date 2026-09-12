import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
		AdminTextPipe,
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
	public readonly state = toSignal(this.searchService.state$, {
		initialValue: { status: 'idle' } as const,
	});
	public readonly searchResults = computed(() => {
		const state = this.state();
		return state.status === 'ready'
			? [...state.results].sort(this.sortBy())
			: undefined;
	});

	constructor() {
		addIcons({ backspaceOutline });
	}

	public refresh(): void {
		this.searchService.refresh();
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
