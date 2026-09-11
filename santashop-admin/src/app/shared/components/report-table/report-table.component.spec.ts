import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportTableComponent } from './report-table.component';

describe('ReportTableComponent', () => {
	afterEach(() => vi.restoreAllMocks());
	it('shows accessible headers, real zeros and unavailable metrics and exports the same totals', async () => {
		let exported: Blob | undefined;
		vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
			exported = blob as Blob;
			return 'blob:report';
		});
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
			() => undefined,
		);
		const fixture = TestBed.createComponent(ReportTableComponent);
		fixture.componentRef.setInput('caption', 'Registration progress');
		fixture.componentRef.setInput('columns', [
			{ label: 'Status', description: 'Registration stage.' },
			'Value',
		]);
		fixture.componentRef.setInput('rows', [
			[
				{
					label: 'Canceled',
					description: 'Registrations currently marked as canceled.',
				},
				0,
			],
			['Attendance rate', undefined],
		]);
		fixture.componentRef.setInput('totals', ['Total', 0]);
		fixture.componentRef.setInput('filename', 'outcomes-2026');
		fixture.componentRef.setInput('exportContext', [['Year', 2026]]);
		await fixture.whenStable();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('caption')?.textContent?.trim()).toBe(
			'Registration progress',
		);
		expect(element.querySelectorAll('thead th[scope="col"]')).toHaveLength(
			2,
		);
		expect(element.querySelectorAll('tbody th[scope="row"]')).toHaveLength(
			2,
		);
		const columnHelp = element.querySelector('thead th small');
		const rowHelp = element.querySelector('tbody th small');
		expect(columnHelp?.textContent?.trim()).toBe('Registration stage.');
		expect(rowHelp?.textContent?.trim()).toBe(
			'Registrations currently marked as canceled.',
		);
		if (!rowHelp?.parentElement)
			throw new Error('Expected a row explanation below its label.');
		expect(
			Number.parseFloat(getComputedStyle(rowHelp).fontSize),
		).toBeLessThan(
			Number.parseFloat(getComputedStyle(rowHelp.parentElement).fontSize),
		);
		expect(
			Array.from(element.querySelectorAll('tbody td'), (cell) =>
				cell.textContent?.trim(),
			),
		).toEqual(['0', 'Unavailable']);
		element.querySelector('ion-button')?.click();
		expect(await exported?.text()).toBe(
			'"Year","2026"\r\n"Status","Value"\r\n"Canceled","0"\r\n"Attendance rate","Unavailable"\r\n"Total","0"',
		);
	});
});
