import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';

@Component({
	selector: 'admin-confirmation',
	templateUrl: './confirmation.page.html',
	styleUrls: ['./confirmation.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationPage {
	public readonly checkin$ = this.checkinContext.checkin$;

	constructor(private readonly checkinContext: CheckInContextService) {}

	public ionViewDidLeave(): void {
		this.checkinContext.reset();
	}
}
