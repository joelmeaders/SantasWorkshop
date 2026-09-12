import { AdminLanguageService } from '../../preferences/admin-language.service';
import { AdminTextPipe } from '../../preferences/admin-text.pipe';
import {
	ChangeDetectionStrategy,
	Component,
	input,
	inject,
} from '@angular/core';
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
	imports: [AdminTextPipe, IonButton],
	template: `
		<ion-button
			fill="outline"
			(click)="download()"
			[disabled]="!rows().length"
		>
			{{ 'Download {{v0}} CSV' | adminText: {v0: (caption() | adminText)}
			}}
		</ion-button>
		<div
			class="table-scroll"
			role="region"
			[attr.aria-label]="caption() | adminText"
			tabindex="0"
		>
			<table>
				<caption>
					{{
						caption() | adminText
					}}
				</caption>
				<thead>
					<tr>
						@for (column of columns(); track $index) {
							<th scope="col">
								{{ cellValue(column) | adminText }}
								@if (description(column); as explanation) {
									<small class="label-description">{{
										explanation | adminText
									}}</small>
								}
							</th>
						}
					</tr>
				</thead>
				<tbody>
					@for (row of displayRows() ?? rows(); track $index) {
						<tr>
							@for (cell of row; track $index) {
								@if ($first) {
									<th scope="row">
										{{ displayCell(cell, $index) }}
										@if (
											description(cell);
											as explanation
										) {
											<small class="label-description">{{
												explanation | adminText
											}}</small>
										}
									</th>
								} @else {
									<td>
										{{ displayCell(cell, $index) }}
									</td>
								}
							}
						</tr>
					} @empty {
						<tr>
							<td [attr.colspan]="columns().length">
								{{ emptyText() | adminText }}
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
										{{ displayCell(cell, $index) }}
									</th>
								} @else {
									<td>
										{{ displayCell(cell, $index) }}
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
	private readonly language = inject(AdminLanguageService);
	public readonly displayRows = input<readonly (readonly ReportCell[])[]>();
	public readonly columnFormats = input<
		Record<number, 'calendar-date' | 'utc-date-time' | 'percent'>
	>({});
	public displayCell(cell: ReportCell, column: number): string {
		const value = this.cellValue(cell);
		if (value == null) return this.language.text('Unavailable');
		const format = this.columnFormats()[column];
		if (typeof value === 'string') {
			if (format === 'calendar-date' && /^\d{4}-\d{2}-\d{2}$/.test(value))
				return new Intl.DateTimeFormat(this.language.locale(), {
					dateStyle: 'medium',
					timeZone: 'UTC',
				}).format(new Date(value));
			if (format === 'utc-date-time' && /^\d{4}-.*Z$/.test(value))
				return (
					new Intl.DateTimeFormat(this.language.locale(), {
						dateStyle: 'medium',
						timeStyle: 'short',
						timeZone: 'UTC',
					}).format(new Date(value)) + ' UTC'
				);
			if (format === 'percent' && /^\d+(\.\d+)?%$/.test(value))
				return new Intl.NumberFormat(this.language.locale(), {
					style: 'percent',
					minimumFractionDigits: 1,
					maximumFractionDigits: 1,
				}).format(Number.parseFloat(value) / 100);
			return this.language.text(value);
		}
		return new Intl.NumberFormat(this.language.locale()).format(value);
	}

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
