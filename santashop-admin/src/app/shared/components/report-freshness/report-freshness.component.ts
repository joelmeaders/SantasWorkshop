import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
} from '@angular/core';
import { EventDatePipe } from '@santashop/core/admin';
import { EVENT_TIME_ZONE } from '@santashop/models';
import { reportDate } from '../../helpers/report-export';

@Component({
	selector: 'admin-report-freshness',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [EventDatePipe],
	template: `
		<p>
			<strong>{{ label() }}:</strong>
			@if (date(); as calculated) {
				Calculated {{ calculated | eventDate: 'short' }} ({{
					timeZone
				}}).
				@if (isOld()) {
					<span class="old"
						>This calculation is over {{ maxAgeHours() }} hours old.
						Check the report update schedule.</span
					>
				}
			} @else {
				Calculation time unavailable for this saved report.
			}
		</p>
	`,
	styles: `
		.old {
			display: block;
			font-weight: 600;
		}
	`,
})
export class ReportFreshnessComponent {
	public readonly timeZone = EVENT_TIME_ZONE;
	public readonly label = input.required<string>();
	public readonly calculatedAt = input<unknown>();
	public readonly currentSeason = input(false);
	public readonly maxAgeHours = input(36);
	public readonly date = computed(() => reportDate(this.calculatedAt()));
	public readonly isOld = computed(() => {
		const date = this.date();
		return (
			!!date &&
			this.currentSeason() &&
			Date.now() - date.valueOf() > this.maxAgeHours() * 60 * 60 * 1000
		);
	});
}
