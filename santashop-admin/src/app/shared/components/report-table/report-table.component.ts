import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { downloadReportCsv, ReportCell } from '../../helpers/report-export';

@Component({
	selector: 'admin-report-table',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonButton],
	template: `
		<ion-button
			fill="outline"
			(click)="download()"
			[disabled]="!rows().length"
		>
			Download {{ caption() }} CSV
		</ion-button>
		<div
			class="table-scroll"
			role="region"
			[attr.aria-label]="caption()"
			tabindex="0"
		>
			<table>
				<caption>
					{{
						caption()
					}}
				</caption>
				<thead>
					<tr>
						@for (column of columns(); track $index) {
							<th scope="col">{{ column }}</th>
						}
					</tr>
				</thead>
				<tbody>
					@for (row of rows(); track $index) {
						<tr>
							@for (cell of row; track $index) {
								@if ($first) {
									<th scope="row">
										{{ cell ?? 'Unavailable' }}
									</th>
								} @else {
									<td>{{ cell ?? 'Unavailable' }}</td>
								}
							}
						</tr>
					} @empty {
						<tr>
							<td [attr.colspan]="columns().length">
								{{ emptyText() }}
							</td>
						</tr>
					}
				</tbody>
				@if (totals(); as total) {
					<tfoot>
						<tr>
							@for (cell of total; track $index) {
								@if ($first) {
									<th scope="row">
										{{ cell ?? 'Unavailable' }}
									</th>
								} @else {
									<td>{{ cell ?? 'Unavailable' }}</td>
								}
							}
						</tr>
					</tfoot>
				}
			</table>
		</div>
	`,
	styles: `
		:host {
			display: block;
			margin: 1rem 0;
		}
		.table-scroll {
			overflow-x: auto;
		}
		table {
			border-collapse: collapse;
			width: 100%;
		}
		caption {
			font-size: 1.15rem;
			font-weight: 600;
			text-align: start;
			padding: 0.75rem;
		}
		th,
		td {
			padding: 0.65rem 0.75rem;
			text-align: start;
			border-bottom: 1px solid var(--ion-color-step-200, #ccc);
		}
		thead,
		tfoot {
			background: var(--ion-color-light, #f4f5f8);
		}
	`,
})
export class ReportTableComponent {
	public readonly caption = input.required<string>();
	public readonly columns = input.required<readonly string[]>();
	public readonly rows = input.required<readonly (readonly ReportCell[])[]>();
	public readonly totals = input<readonly ReportCell[]>();
	public readonly filename = input.required<string>();
	public readonly emptyText = input('No rows recorded in this report.');
	public readonly exportContext = input<readonly (readonly ReportCell[])[]>(
		[],
	);

	public download(): void {
		if (!this.rows().length) return;
		const total = this.totals();
		downloadReportCsv(this.filename(), [
			...this.exportContext(),
			this.columns(),
			...this.rows(),
			...(total ? [total] : []),
		]);
	}
}
