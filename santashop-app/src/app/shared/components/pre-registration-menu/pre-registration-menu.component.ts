import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '../../../core';

@Component({
	selector: 'app-pre-registration-menu',
	templateUrl: './pre-registration-menu.component.html',
	styleUrls: ['./pre-registration-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreRegistrationMenuComponent {
	public readonly childCount$ = this.viewService.childCount$;

	public readonly chosenSlot$ = this.viewService.dateTimeSlot$;

	public readonly isRegistrationComplete$ =
		this.viewService.registrationComplete$;

	constructor(private readonly viewService: PreRegistrationService) {}
}
