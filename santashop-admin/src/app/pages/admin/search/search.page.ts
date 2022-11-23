import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'admin-search',
	templateUrl: './search.page.html',
	styleUrls: ['./search.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {}
