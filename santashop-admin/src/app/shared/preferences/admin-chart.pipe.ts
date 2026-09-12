import { Pipe, PipeTransform, inject } from '@angular/core';
import { type ChartData, type ChartOptions, type ChartType } from 'chart.js';
import { type Context } from 'chartjs-plugin-datalabels';
import { AdminLanguageService } from './admin-language.service';
import { AdminThemeService } from './admin-theme.service';

const chartColors = [
	'#a52336',
	'#326969',
	'#655080',
	'#876100',
	'#47619c',
	'#9e4b23',
	'#595959',
];

@Pipe({ name: 'adminChart', standalone: true, pure: false })
export class AdminChartPipe implements PipeTransform {
	private readonly language = inject(AdminLanguageService);
	private source?: object;
	private locale?: string;
	private result?: object;
	public transform<T extends ChartType>(data: ChartData<T>): ChartData<T> {
		if (this.source === data && this.locale === this.language.language())
			return this.result as ChartData<T>;
		this.source = data;
		this.locale = this.language.language();
		const label = (value: unknown): unknown =>
			Array.isArray(value)
				? value.map(label)
				: typeof value === 'string'
					? this.language.text(value)
					: value;
		this.result = {
			...data,
			labels: data.labels?.map(label),
			datasets: data.datasets.map((dataset, index) => ({
				...dataset,
				label: dataset.label
					? this.language.text(dataset.label)
					: dataset.label,
				backgroundColor:
					data.datasets.length === 1
						? chartColors
						: chartColors[index % chartColors.length],
				borderColor:
					data.datasets.length === 1
						? chartColors
						: chartColors[index % chartColors.length],
				borderWidth: 1,
			})),
		};
		return this.result as ChartData<T>;
	}
}

@Pipe({ name: 'adminChartOptions', standalone: true, pure: false })
export class AdminChartOptionsPipe implements PipeTransform {
	private readonly theme = inject(AdminThemeService);
	private readonly language = inject(AdminLanguageService);
	private source?: object;
	private key = '';
	private result?: object;
	public transform<T extends ChartType>(
		options: ChartOptions<T> | undefined,
	): ChartOptions<T> {
		const key = `${this.theme.dark()}:${this.language.language()}`;
		if (this.source === options && this.key === key && this.result)
			return this.result as ChartOptions<T>;
		this.source = options;
		this.key = key;
		const color = this.theme.dark() ? '#f4f1ed' : '#242321';
		const grid = this.theme.dark() ? '#3c3a38' : '#d8d6d2';
		this.result = {
			...options,
			animation: false,
			color,
			locale: this.language.locale(),
			responsive: true,
			plugins: {
				...options?.plugins,
				legend: {
					...options?.plugins?.legend,
					labels: { ...options?.plugins?.legend?.labels, color },
				},
				datalabels: {
					...options?.plugins?.datalabels,
					display: options?.plugins?.datalabels?.display ??
						((context: Context): boolean => context.dataset.data[context.dataIndex] !== 0),
					color: '#fff',
					font: { size: 12, weight: 'bold' },
					textShadowBlur: 0,
					textStrokeWidth: 0,
				},
			},
			...(options?.scales
				? {
						scales: Object.fromEntries(
							Object.entries(
								options.scales as Record<
									string,
									{
										ticks?: object;
										grid?: object;
										title?: object;
									}
								>,
							).map(([name, scale]) => [
								name,
								{
									...scale,
									ticks: { ...scale?.ticks, color },
									grid: { ...scale?.grid, color: grid },
									title: { ...scale?.title, color },
								},
							]),
						),
					}
				: {}),
		};
		return this.result as ChartOptions<T>;
	}
}
