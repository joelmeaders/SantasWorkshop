import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DateTimeSlot } from '@models/*';

@Component({
	selector: 'app-schedule-card',
	templateUrl: './schedule-card.component.html',
	styleUrls: ['./schedule-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleCardComponent {
	@Input() public dateTimeSlot?: DateTimeSlot;

	@Input() public canChooseDateTime = false;
}
