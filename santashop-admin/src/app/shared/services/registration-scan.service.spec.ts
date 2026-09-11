import { AuthService } from '@santashop/core/admin';
import { BehaviorSubject, of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
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
							dateOfBirth: {
								_seconds: 1_546_300_800,
								_nanoseconds: 0,
							},
						},
					],
				},
				attempt: {
					scannedOn: {
						seconds: 1_700_000_000,
						nanoseconds: 500_000_000,
					},
				},
			},
		});
		TestBed.configureTestingModule({
			providers: [
				RegistrationScanService,
				{ provide: AuthService, useValue: { uid$: of('staff-1') } },
				{
					provide: FunctionsWrapper,
					useValue: {
						callableWrapper: vi.fn().mockReturnValue(callable),
					},
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

	it('rejects a late scan result even if the same account signs back in', async () => {
		const uid$ = new BehaviorSubject<string | null>('staff-a');
		let resolve!: (value: unknown) => void;
		const callable = vi.fn().mockReturnValue(
			new Promise((done) => {
				resolve = done;
			}),
		);
		TestBed.configureTestingModule({
			providers: [
				{ provide: AuthService, useValue: { uid$ } },
				{
					provide: FunctionsWrapper,
					useValue: {
						callableWrapper: vi.fn().mockReturnValue(callable),
					},
				},
			],
		});
		const service = TestBed.inject(RegistrationScanService);
		const result = service.resolve({
			code: 'ABCDEFGH',
			inputMethod: 'manual',
		});
		const rejected = expect(result).rejects.toThrow(
			'signed-in account changed',
		);
		await vi.waitFor(() => expect(callable).toHaveBeenCalledOnce());
		uid$.next(null);
		uid$.next('staff-a');
		resolve({ data: { disposition: 'not-found' } });
		await rejected;
		uid$.next(null);
		await expect(
			service.resolve({ code: 'ABCDEFGH', inputMethod: 'manual' }),
		).rejects.toThrow('Sign in');
		expect(callable).toHaveBeenCalledOnce();
	});
});
