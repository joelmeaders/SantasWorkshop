import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStateService } from '../../shared/services/app-state.service';

@Component({
	selector: 'admin-admin',
	templateUrl: './admin.page.html',
	styleUrls: ['./admin.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
	private readonly appStateService = inject(AppStateService);

	public readonly preRegistrationEnabled$ = this.appStateService.preRegistrationEnabled$;
	public readonly onsiteRegistrationEnabled$ = this.appStateService.onsiteRegistrationEnabled$;
	public readonly checkinEnabled$ = this.appStateService.checkinEnabled$;
}
