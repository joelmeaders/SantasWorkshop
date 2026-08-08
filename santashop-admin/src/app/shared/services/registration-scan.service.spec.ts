import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core';
import { describe, expect, it, vi } from 'vitest';
import { RegistrationScanService } from './registration-scan.service';

describe('RegistrationScanService', () => {
	it('deserializes nested callable timestamps before returning scan data', async () => {
		const callable = vi.fn().mockResolvedValue({
			data: {
				disposition: 'duplicate-risk',
				registration: {
					uid: 'customer-1',
					qrCodeStoragePath: 'registrations/customer-1/code.png',
					children: [
						{
							dateOfBirth: { _seconds: 1_546_300_800, _nanoseconds: 0 },
						},
					],
				},
				attempt: {
					scannedOn: { seconds: 1_700_000_000, nanoseconds: 500_000_000 },
				},
			},
		});
		TestBed.configureTestingModule({
			providers: [
				RegistrationScanService,
				{
					provide: FunctionsWrapper,
					useValue: { callableWrapper: vi.fn().mockReturnValue(callable) },
				},
			],
		});

		const result = await TestBed.inject(RegistrationScanService).resolve({
			code: 'ABCDEFGH',
			inputMethod: 'manual',
		});

		expect(callable).toHaveBeenCalledWith({
			code: 'ABCDEFGH',
			inputMethod: 'manual',
		});
		if (result.disposition !== 'duplicate-risk') {
			throw new Error('Expected a duplicate risk result.');
		}
		expect(result.registration.children?.[0]?.dateOfBirth).toEqual(
			new Date(1_546_300_800_000),
		);
		expect(result.attempt.scannedOn).toEqual(new Date(1_700_000_000_500));
	});
});
