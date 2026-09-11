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
		fixture.componentRef.setInput('caption', 'Registration outcomes');
		fixture.componentRef.setInput('columns', ['Measure', 'Value']);
		fixture.componentRef.setInput('rows', [
			['Cancelled', 0],
			['Attendance rate', undefined],
		]);
		fixture.componentRef.setInput('totals', ['Total', 0]);
		fixture.componentRef.setInput('filename', 'outcomes-2026');
		fixture.componentRef.setInput('exportContext', [
			['Program year', 2026],
		]);
		await fixture.whenStable();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('caption')?.textContent?.trim()).toBe(
			'Registration outcomes',
		);
		expect(element.querySelectorAll('thead th[scope="col"]')).toHaveLength(
			2,
		);
		expect(element.querySelectorAll('tbody th[scope="row"]')).toHaveLength(
			2,
		);
		expect(
			Array.from(element.querySelectorAll('tbody td'), (cell) =>
				cell.textContent?.trim(),
			),
		).toEqual(['0', 'Unavailable']);
		element.querySelector('ion-button')?.click();
		expect(await exported?.text()).toBe(
			'"Program year","2026"\r\n"Measure","Value"\r\n"Cancelled","0"\r\n"Attendance rate","Unavailable"\r\n"Total","0"',
		);
	});
});
