import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Chart, type ChartData, type ChartOptions } from 'chart.js';
import { type Context } from 'chartjs-plugin-datalabels';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminChartOptionsPipe, AdminChartPipe } from './admin-chart.pipe';
import { AdminLanguageService } from './admin-language.service';
import { AdminThemeService } from './admin-theme.service';

describe('Admin report chart presentation', () => {
	const language = signal<'en' | 'es'>('en');
	const dark = signal(false);
	beforeEach(() => {
		language.set('en');
		dark.set(false);
		TestBed.configureTestingModule({ providers: [
			{ provide: AdminLanguageService, useValue: {
				language,
				locale: (): string => language() === 'es' ? 'es-US' : 'en-US',
				text: (value: string): string => language() === 'es' && value === 'Used' ? 'Usados' : value,
			} },
			{ provide: AdminThemeService, useValue: { dark } },
		] });
	});

	it('translates chart labels without changing source data or real zeros', () => {
		const pipe = TestBed.runInInjectionContext(() => new AdminChartPipe());
		const source: ChartData<'doughnut'> = { labels: ['Used'], datasets: [{ label: 'Used', data: [0, 1200] }] };
		const original = structuredClone(source);
		const english = pipe.transform(source);
		language.set('es');
		const spanish = pipe.transform(source);
		expect(spanish.labels).toEqual(['Usados']);
		expect(spanish.datasets[0].label).toBe('Usados');
		expect(spanish.datasets[0].data).toEqual([0, 1200]);
		expect(spanish).not.toBe(english);
		expect(source).toEqual(original);
	});

	it('keeps empty chart labels from overlapping and applies theme changes without animation', () => {
		const pipe = TestBed.runInInjectionContext(() => new AdminChartOptionsPipe());
		const source: ChartOptions<'doughnut'> = { plugins: { legend: { display: false } } };
		const light = pipe.transform(source);
		const display = light.plugins?.datalabels?.display;
		if (typeof display !== 'function') throw new Error('Expected a chart label visibility function.');
		const context: Context = { active: false, chart: {} as Chart, dataset: { data: [0, 1200] }, datasetIndex: 0, dataIndex: 0 };
		expect(display(context)).toBe(false);
		expect(display({ ...context, dataIndex: 1 })).toBe(true);
		expect(light.animation).toBe(false);
		dark.set(true);
		language.set('es');
		const changed = pipe.transform(source);
		expect(changed.locale).toBe('es-US');
		expect(changed.color).not.toBe(light.color);
		expect(changed.plugins?.legend?.display).toBe(false);
		expect(source).toEqual({ plugins: { legend: { display: false } } });
	});
});
