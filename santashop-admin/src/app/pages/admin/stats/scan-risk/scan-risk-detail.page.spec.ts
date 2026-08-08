import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { firstValueFrom, of, skip, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRAM_YEAR } from '@santashop/core';
import { ScanRiskService } from '../../../../shared/services/scan-risk.service';
import { ScanRiskDetailPage } from './scan-risk-detail.page';

describe('ScanRiskDetailPage', () => {
	let component: ScanRiskDetailPage;
	let fixture: ComponentFixture<ScanRiskDetailPage>;
	const checkIn = vi.fn();
	const attempts = vi.fn();

	beforeEach(async () => {
		checkIn.mockReset(); attempts.mockReset();
		checkIn.mockReturnValue(of(undefined)); attempts.mockReturnValue(of([]));
		TestBed.configureTestingModule({
			imports: [ScanRiskDetailPage],
			providers: [
				{ provide: PROGRAM_YEAR, useValue: 2026 },
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ uid: 'customer-1' })) } },
				{ provide: ScanRiskService, useValue: { checkIn, attempts } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ScanRiskDetailPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('loads the selected customer check-in and risk attempts', async () => {
		checkIn.mockReturnValue(of({ id: 'customer-1' })); attempts.mockReturnValue(of([{ id: 'attempt-1' }]));
		await expect(firstValueFrom(component.state$.pipe(skip(1)))).resolves.toMatchObject({
			status: 'ready', checkIn: { id: 'customer-1' }, attempts: [{ id: 'attempt-1' }],
		});
		expect(checkIn).toHaveBeenCalledWith('customer-1');
		expect(attempts).toHaveBeenCalledWith(2026, 'customer-1');
	});

	it('returns an error state when either data request fails', async () => {
		attempts.mockReturnValue(throwError(() => new Error('unavailable')));
		await expect(firstValueFrom(component.state$.pipe(skip(1)))).resolves.toEqual({ status: 'error' });
	});
});
