import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ReportFreshnessComponent } from './report-freshness.component';

describe('ReportFreshnessComponent', () => {
	it('labels unknown legacy calculation times without using page load time', async () => {
		const fixture = TestBed.createComponent(ReportFreshnessComponent);
		fixture.componentRef.setInput('label', 'Registration and demographics');
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Calculation time unavailable for this saved report.',
		);
		expect(fixture.componentInstance.date()).toBeUndefined();
	});

	it('flags old current-season calculations but leaves historical calculations as dated reports', async () => {
		const fixture = TestBed.createComponent(ReportFreshnessComponent);
		fixture.componentRef.setInput('label', 'Registration and demographics');
		fixture.componentRef.setInput(
			'calculatedAt',
			new Date(Date.now() - 40 * 60 * 60 * 1000),
		);
		fixture.componentRef.setInput('currentSeason', true);
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'over 36 hours old',
		);
		fixture.componentRef.setInput('currentSeason', false);
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).not.toContain('hours old');
		expect(fixture.nativeElement.textContent).toContain('Calculated');
	});
});
