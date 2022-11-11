import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
	selector: 'app-bad-weather',
	templateUrl: './bad-weather.page.html',
	styleUrls: ['./bad-weather.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadWeatherPage {
	public readonly message$ = this.service.message$;

	constructor(public readonly service: AppStateService) {}
}
