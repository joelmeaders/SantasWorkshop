import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
	selector: 'app-maintenance',
	templateUrl: './maintenance.page.html',
	styleUrls: ['./maintenance.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenancePage {
	public readonly message$ = this.service.message$;

	constructor(public readonly service: AppStateService) {}
}
