import { AdminDatePipe } from '../../preferences/admin-date.pipe';
import { AdminTextPipe } from '../../preferences/admin-text.pipe';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
} from '@angular/core';

import { reportDate } from '../../helpers/report-export';

@Component({
	selector: 'admin-report-freshness',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AdminTextPipe, AdminDatePipe],
	template: `
		<p>
			<strong>{{ label() | adminText }}:</strong>
			@if (date(); as calculated) {
				{{ 'Updated {{v0}} (Denver time).' | adminText: {v0: (calculated
				| adminDate: 'short')} }}
				@if (isOld()) {
					<span class="old">
						{{ 'Over {{v0}} hours old. A newer update may be due.' |
						adminText: {v0: (maxAgeHours())} }}
					</span>
				}
			} @else {
				{{ 'Update time not saved in this report.' | adminText }}
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
