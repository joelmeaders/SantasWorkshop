import { TestBed } from '@angular/core/testing';
import { FireRepoLite } from '@santashop/core';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanRiskService } from './scan-risk.service';

describe('ScanRiskService', () => {
	const read = vi.fn();
	const readMany = vi.fn();

	beforeEach(() => {
		read.mockReset();
		readMany.mockReset();
		TestBed.configureTestingModule({
			providers: [
				ScanRiskService,
				{
					provide: FireRepoLite,
					useValue: { collection: vi.fn().mockReturnValue({ read, readMany }) },
				},
			],
		});
	});

	it('queries and normalizes risk summaries with optional original check-ins', async () => {
		readMany.mockReturnValue(of([{
			customerId: 'customer-1',
			firstRiskOn: { toDate: (): Date => new Date('2026-12-01') },
			latestRiskOn: { toDate: (): Date => new Date('2026-12-02') },
			originalCheckInOn: { toDate: (): Date => new Date('2026-12-03') },
		}]));

		const summaries = await firstValueFrom(
			TestBed.inject(ScanRiskService).summaries(2026, 21),
		);

		expect(summaries[0]).toMatchObject({
			customerId: 'customer-1',
			firstRiskOn: new Date('2026-12-01'),
			latestRiskOn: new Date('2026-12-02'),
			originalCheckInOn: new Date('2026-12-03'),
		});
		expect(readMany).toHaveBeenCalledOnce();
	});

	it('normalizes individual attempts and optional check-ins', async () => {
		readMany.mockReturnValue(of([{
			customerId: 'customer-1',
			scannedOn: { toDate: (): Date => new Date('2026-12-04') },
			priorEventOn: { toDate: (): Date => new Date('2026-12-03') },
		}]));
		read.mockReturnValue(of({
			id: 'customer-1',
			checkInDateTime: { toDate: (): Date => new Date('2026-12-03') },
		}));
		const service = TestBed.inject(ScanRiskService);

		await expect(firstValueFrom(service.attempts(2026, 'customer-1'))).resolves
			.toMatchObject([{ scannedOn: new Date('2026-12-04'), priorEventOn: new Date('2026-12-03') }]);
		await expect(firstValueFrom(service.checkIn('customer-1'))).resolves.toMatchObject({
			checkInDateTime: new Date('2026-12-03'),
		});
	});
});
