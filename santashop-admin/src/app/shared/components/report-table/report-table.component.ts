import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import {
	downloadReportCsv,
	reportCellValue,
	ReportCell,
	ReportLabel,
} from '../../helpers/report-export';

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
							<th scope="col">
								{{ cellValue(column) }}
								@if (description(column); as explanation) {
									<small class="label-description">{{
										explanation
									}}</small>
								}
							</th>
						}
					</tr>
				</thead>
				<tbody>
					@for (row of rows(); track $index) {
						<tr>
							@for (cell of row; track $index) {
								@if ($first) {
									<th scope="row">
										{{ cellValue(cell) ?? 'Unavailable' }}
										@if (
											description(cell);
											as explanation
										) {
											<small class="label-description">{{
												explanation
											}}</small>
										}
									</th>
								} @else {
									<td>
										{{ cellValue(cell) ?? 'Unavailable' }}
									</td>
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
										{{ cellValue(cell) ?? 'Unavailable' }}
									</th>
								} @else {
									<td>
										{{ cellValue(cell) ?? 'Unavailable' }}
									</td>
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
			vertical-align: top;
		}
		.label-description {
			display: block;
			margin-top: 0.25rem;
			font-size: 0.8125rem;
			font-weight: 400;
			line-height: 1.4;
			color: var(--ion-text-color, #222);
			max-width: 32rem;
		}
		thead,
		tfoot {
			background: var(--ion-color-light, #f4f5f8);
		}
	`,
})
export class ReportTableComponent {
	public readonly caption = input.required<string>();
	public readonly columns =
		input.required<readonly (string | ReportLabel)[]>();
	public readonly rows = input.required<readonly (readonly ReportCell[])[]>();
	public readonly totals = input<readonly ReportCell[]>();
	public readonly filename = input.required<string>();
	public readonly emptyText = input('No data in this report.');
	public readonly exportContext = input<readonly (readonly ReportCell[])[]>(
		[],
	);

	public readonly cellValue = reportCellValue;

	public description(cell: ReportCell): string | undefined {
		return cell && typeof cell === 'object' ? cell.description : undefined;
	}

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
