import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, Subscription, throwError } from 'rxjs';
import { limit, orderBy, where } from 'firebase/firestore/lite';
import type { RegistrationSearchIndex, User } from '@santashop/models';
import {
	AdminReadRepository,
	type AdminReadCollection,
} from '../../../shared/services/admin-read-repository.service';
import { SearchService, type SearchState } from './search.service';

describe('SearchService', () => {
	let service: SearchService;
	let reads: ReturnType<
		typeof vi.fn<AdminReadCollection<RegistrationSearchIndex>['readMany']>
	>;
	let userReads: ReturnType<
		typeof vi.fn<AdminReadCollection<User>['readMany']>
	>;
	let subscriptions: Subscription;
	let states: SearchState[];
	beforeEach(() => {
		reads = vi
			.fn<AdminReadCollection<RegistrationSearchIndex>['readMany']>()
			.mockReturnValue(of([]));
		userReads = vi
			.fn<AdminReadCollection<User>['readMany']>()
			.mockReturnValue(of([]));
		subscriptions = new Subscription();
		states = [];
		TestBed.configureTestingModule({
			providers: [
				{
					provide: AdminReadRepository,
					useValue: {
						collection: vi
							.fn()
							.mockReturnValueOnce({ readMany: reads })
							.mockReturnValueOnce({ readMany: userReads }),
					},
				},
			],
		});
		service = TestBed.inject(SearchService);
		subscriptions.add(
			service.state$.subscribe((state) => states.push(state)),
		);
	});
	afterEach(() => {
		subscriptions.unsubscribe();
		vi.useRealTimers();
	});

	it('starts idle without fetching, including an idle refresh', () => {
		service.refresh();
		expect(states.at(-1)).toEqual({ status: 'idle' });
		expect(reads).not.toHaveBeenCalled();
	});

	it('normalizes queries, preserves ZIP zeros, and bounds search results', async () => {
		service.searchByLastNameZip('SMITH', '01234');
		expect(reads).toHaveBeenLastCalledWith([
			where('zip', '==', '01234'),
			where('lastName', '>=', 'smith'),
			where('lastName', '<=', 'smith\uf8ff'),
			orderBy('lastName', 'asc'),
			limit(50),
		]);
		service.searchByEmail('FAMILY@EXAMPLE.TEST');
		expect(reads).toHaveBeenLastCalledWith([
			where('emailAddress', '>=', 'family@example.test'),
			where('emailAddress', '<=', 'family@example.test\uf8ff'),
			orderBy('emailAddress', 'asc'),
			limit(50),
		]);
		service.searchByCode('ab12cd');
		expect(reads).toHaveBeenLastCalledWith([
			where('code', '==', 'AB12CD'),
			limit(50),
		]);
		await firstValueFrom(
			service.searchUsersByEmailAddress('FAMILY@EXAMPLE.TEST'),
		);
		expect(userReads).toHaveBeenLastCalledWith([
			where('emailAddress', '==', 'family@example.test'),
		]);
	});

	it('shares one read, replaces a pending query, and clears on reset', () => {
		const first = new Subject<RegistrationSearchIndex[]>();
		const second = new Subject<RegistrationSearchIndex[]>();
		reads.mockReturnValueOnce(first).mockReturnValueOnce(second);
		service.searchByCode('first');
		subscriptions.add(service.state$.subscribe());
		expect(reads).toHaveBeenCalledTimes(1);
		expect(states.at(-1)).toEqual({ status: 'loading' });
		service.searchByCode('second');
		expect(first.observed).toBe(false);
		first.next([{ customerId: 'stale' } as RegistrationSearchIndex]);
		expect(states.at(-1)).toEqual({ status: 'loading' });
		second.next([]);
		expect(states.at(-1)).toEqual({ status: 'ready', results: [] });
		service.reset();
		expect(second.observed).toBe(false);
		expect(states.at(-1)).toEqual({ status: 'idle' });
	});

	it('reports an error and retries the same criteria without completing state', () => {
		reads
			.mockReturnValueOnce(throwError(() => new Error('offline')))
			.mockReturnValueOnce(of([]));
		service.searchByEmail('a@example.test');
		expect(states.at(-1)).toEqual({ status: 'error' });
		service.refresh();
		expect(reads.mock.calls[1]).toEqual(reads.mock.calls[0]);
		expect(states.at(-1)).toEqual({ status: 'ready', results: [] });
	});

	it('times out a stalled read and can recover on refresh', async () => {
		vi.useFakeTimers();
		const pending = new Subject<RegistrationSearchIndex[]>();
		reads.mockReturnValueOnce(pending).mockReturnValueOnce(of([]));
		service.searchByCode('slow');
		await vi.advanceTimersByTimeAsync(5000);
		expect(states.at(-1)).toEqual({ status: 'error' });
		expect(pending.observed).toBe(false);
		service.refresh();
		expect(states.at(-1)).toEqual({ status: 'ready', results: [] });
	});

	it('releases the last subscription and fetches fresh data on resubscription', () => {
		const pending = new Subject<RegistrationSearchIndex[]>();
		reads.mockReturnValue(pending);
		service.searchByCode('again');
		subscriptions.unsubscribe();
		expect(pending.observed).toBe(false);
		subscriptions = service.state$.subscribe();
		expect(reads).toHaveBeenCalledTimes(2);
	});
});
