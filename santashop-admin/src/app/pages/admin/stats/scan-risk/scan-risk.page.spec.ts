import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import { ScanRiskService } from '../../../../shared/services/scan-risk.service';
import { ScanRiskPage } from './scan-risk.page';
import { provideActivatedRouteMock } from '../../../../../test-helpers';

describe('ScanRiskPage', () => {
	let component: ScanRiskPage;
	let fixture: ComponentFixture<ScanRiskPage>;
	const summaries = vi.fn();

	beforeEach(async () => {
		summaries.mockReset();
		summaries.mockReturnValue(of([]));
		TestBed.configureTestingModule({
			imports: [ScanRiskPage],
			providers: [
				{ provide: PROGRAM_YEAR, useValue: 2026 },
				{ provide: ScanRiskService, useValue: { summaries } },
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ScanRiskPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('exposes a ready page of summaries and requests one extra record', async () => {
		summaries.mockReturnValue(
			of(
				Array.from({ length: 21 }, (_, index) => ({
					customerId: `customer-${index}`,
					firstName: 'Santa',
					lastName: 'Family',
					latestRiskOn: new Date(),
				})),
			),
		);
		component.refresh();
		await fixture.whenStable();
		const state = component.state();
		expect(state).toMatchObject({ status: 'ready', hasMore: true });
		if (state.status === 'ready') expect(state.summaries).toHaveLength(20);
		expect(summaries).toHaveBeenLastCalledWith(2026, 21);
	});

	it('increases the page size by twenty when more records are requested', async () => {
		component.loadMore();
		await fixture.whenStable();
		expect(summaries).toHaveBeenLastCalledWith(2026, 41);
	});

	it('exposes an error state when the risk query fails', async () => {
		summaries.mockReturnValue(throwError(() => new Error('unavailable')));
		component.refresh();
		await fixture.whenStable();
		expect(component.state()).toEqual({ status: 'error' });
	});

	it('refreshes the current page size and retries failures through the visible button', async () => {
		component.loadMore();
		summaries.mockReturnValue(throwError(() => new Error('offline')));
		component.refresh();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			'Risk records could not be loaded',
		);
		summaries.mockClear().mockReturnValue(of([]));
		fixture.nativeElement.querySelector('ion-content ion-button').click();
		await fixture.whenStable();
		expect(summaries).toHaveBeenCalledExactlyOnceWith(2026, 41);
		expect(fixture.nativeElement.textContent).toContain(
			'No suspicious scans this season',
		);
	});
});
