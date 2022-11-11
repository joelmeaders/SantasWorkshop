import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
	selector: 'app-registration-closed',
	templateUrl: './registration-closed.page.html',
	styleUrls: ['./registration-closed.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationClosedPage {
	public readonly message$ = this.service.message$;

	constructor(public readonly service: AppStateService) {}
}
