import { TestBed } from '@angular/core/testing';
import { FireRepoLite } from '@santashop/core';
import type {
	CheckIn,
	Registration,
	RegistrationSearchIndex,
} from '@santashop/models';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LookupService } from './lookup.service';

describe('LookupService', () => {
	const searchReadMany = vi.fn();
	const registrationReadMany = vi.fn();
	const registrationRead = vi.fn();
	const checkinRead = vi.fn();
	const collection = vi.fn((name: string) => {
		if (name === 'registrationsearchindex') {
			return { readMany: searchReadMany };
		}
		if (name === 'registrations') {
			return { readMany: registrationReadMany, read: registrationRead };
		}
		return { read: checkinRead };
	});
	const searchResult = (
		overrides: Partial<RegistrationSearchIndex> = {},
	): RegistrationSearchIndex => ({
		firstName: 'Holly',
		lastName: 'Jolly',
		emailAddress: 'holly@example.com',
		customerId: 'customer-1',
		zip: '80202',
		...overrides,
	});

	beforeEach(() => {
		searchReadMany.mockReset().mockReturnValue(of([]));
		registrationReadMany.mockReset().mockReturnValue(of([]));
		registrationRead.mockReset().mockReturnValue(of(undefined));
		checkinRead.mockReset().mockReturnValue(of(undefined));
		collection.mockClear();
		TestBed.configureTestingModule({
			providers: [{ provide: FireRepoLite, useValue: { collection } }],
		});
	});

	it('returns name-search results and preserves an empty result set', async () => {
		const result = searchResult();
		searchReadMany.mockReturnValueOnce(of([result]));
		const service = TestBed.inject(LookupService);

		await expect(
			firstValueFrom(service.searchIndexByName$('Holly', 'Jol')),
		).resolves.toEqual([result]);
		expect(searchReadMany).toHaveBeenCalledWith(expect.any(Array));

		searchReadMany.mockReturnValueOnce(of(undefined));
		await expect(
			firstValueFrom(service.searchIndexByName$('Missing', 'Person')),
		).resolves.toEqual([]);
	});

	it('returns QR-code search-index results', async () => {
		const result = searchResult({ code: 'QR-123' });
		searchReadMany.mockReturnValue(of([result]));
		const service = TestBed.inject(LookupService);

		await expect(
			firstValueFrom(service.searchIndexByQrCode$('QR-123')),
		).resolves.toEqual([result]);
	});

	it('returns the matching registration or undefined by QR code', async () => {
		const registration = {
			uid: 'customer-1',
			qrcode: 'QR-123',
		} as Registration;
		registrationReadMany.mockReturnValueOnce(of([registration]));
		const service = TestBed.inject(LookupService);

		await expect(
			firstValueFrom(service.getRegistrationByQrCode$('QR-123')),
		).resolves.toBe(registration);
		registrationReadMany.mockReturnValueOnce(of([]));
		await expect(
			firstValueFrom(service.getRegistrationByQrCode$('missing')),
		).resolves.toBeUndefined();
	});

	it('reads registration and check-in documents by customer uid', async () => {
		const registration = { uid: 'customer-1' } as Registration;
		const checkin = { inStats: false } as CheckIn;
		registrationRead.mockReturnValue(of(registration));
		checkinRead.mockReturnValue(of(checkin));
		const service = TestBed.inject(LookupService);

		await expect(
			firstValueFrom(service.getRegistrationByUid$('customer-1')),
		).resolves.toBe(registration);
		await expect(
			firstValueFrom(service.getCheckinByUid$('customer-1')),
		).resolves.toBe(checkin);
		expect(registrationRead).toHaveBeenCalledWith('customer-1');
		expect(checkinRead).toHaveBeenCalledWith('customer-1');
	});

	it('returns the first matching email index entry', async () => {
		const result = searchResult();
		searchReadMany.mockReturnValue(of([result]));
		const service = TestBed.inject(LookupService);

		await expect(
			firstValueFrom(
				service.getSearchIndexByEmailAddress$('holly@example.com'),
			),
		).resolves.toBe(result);
	});
});
