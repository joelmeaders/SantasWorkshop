import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';
import { FireRepoLite } from '@santashop/core';
import { firstValueFrom, of } from 'rxjs';
import { requireDefined } from '../../../../test-helpers';

describe('SearchService', () => {
	let service: SearchService;
	const indexReadMany = vi.fn();
	const userReadMany = vi.fn();

	beforeEach(() => {
		indexReadMany.mockReset(); userReadMany.mockReset();
		indexReadMany.mockReturnValue(of([{ emailAddress: 'family@example.test' }]));
		userReadMany.mockReturnValue(of([{ uid: 'customer-1' }]));
		TestBed.configureTestingModule({
			providers: [{
				provide: FireRepoLite,
				useValue: {
					collection: vi.fn()
						.mockReturnValueOnce({ readMany: indexReadMany })
						.mockReturnValueOnce({ readMany: userReadMany }),
				},
			}],
		});
		service = TestBed.inject(SearchService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('normalizes name, zip, email, and code searches before publishing their observables', async () => {
		service.searchByLastNameZip('SMITH', 80001);
		const results = await firstValueFrom(service.searchResults$);
		expect(results).toBeTruthy();
		await expect(firstValueFrom(requireDefined(results))).resolves.toEqual([
			{ emailAddress: 'family@example.test' },
		]);
		expect(indexReadMany).toHaveBeenCalledOnce();

		service.searchByEmail('FAMILY@EXAMPLE.TEST');
		service.searchByCode('ab12cd');
		expect(indexReadMany).toHaveBeenCalledTimes(3);
	});

	it('queries users directly for duplicate email detection and clears results on reset', async () => {
		await expect(firstValueFrom(service.searchUsersByEmailAddress('FAMILY@EXAMPLE.TEST')))
			.resolves.toEqual([{ uid: 'customer-1' }]);
		expect(userReadMany).toHaveBeenCalledOnce();

		service.searchByEmail('family@example.test');
		service.reset();
		await expect(firstValueFrom(service.searchResults$)).resolves.toBeNull();
	});
});
