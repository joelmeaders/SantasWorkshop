import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ADMIN_FIRESTORE_LITE,
	ADMIN_LITE_READ_METHODS,
	AdminReadRepository,
} from './admin-read-repository.service';

const methods = {
	collection: vi.fn((_db, path) => ({ path })),
	doc: vi.fn((_db, path, id) => ({ path, id })),
	query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
	getDoc: vi.fn(),
	getDocs: vi.fn(),
};
const { getDoc, getDocs } = methods;

describe('AdminReadRepository', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		TestBed.configureTestingModule({
			providers: [
				AdminReadRepository,
				{ provide: ADMIN_FIRESTORE_LITE, useValue: {} },
				{ provide: ADMIN_LITE_READ_METHODS, useValue: methods },
			],
		});
	});

	it('fetches only on subscription, completes once, and fetches fresh data when requested again', async () => {
		vi.mocked(getDoc)
			.mockResolvedValueOnce({
				exists: () => true,
				id: 'customer',
				data: () => ({ count: 1 }),
			} as never)
			.mockResolvedValueOnce({
				exists: () => true,
				id: 'customer',
				data: () => ({ count: 2 }),
			} as never);
		const read$ = TestBed.inject(AdminReadRepository)
			.collection<{ id: string; count: number }>('stats')
			.read('customer', 'id');
		expect(getDoc).not.toHaveBeenCalled();
		await expect(firstValueFrom(read$.pipe(toArray()))).resolves.toEqual([
			{ id: 'customer', count: 1 },
		]);
		await expect(firstValueFrom(read$.pipe(toArray()))).resolves.toEqual([
			{ id: 'customer', count: 2 },
		]);
		expect(getDoc).toHaveBeenCalledTimes(2);
	});

	it('returns undefined for missing documents and propagates failures for retry', async () => {
		vi.mocked(getDoc)
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce({ exists: () => false } as never);
		const read$ = TestBed.inject(AdminReadRepository)
			.collection('stats')
			.read('missing');
		await expect(firstValueFrom(read$)).rejects.toThrow('offline');
		await expect(firstValueFrom(read$)).resolves.toBeUndefined();
	});

	it('fetches queries once with optional document IDs and preserves timestamp values', async () => {
		const timestamp = { toDate: (): Date => new Date('2026-12-12') };
		vi.mocked(getDocs).mockResolvedValue({
			docs: [{ id: 'one', data: (): object => ({ timestamp }) }],
		} as never);
		const repository = TestBed.inject(AdminReadRepository).collection<{
			id: string;
			timestamp: unknown;
		}>('staff');
		await expect(
			firstValueFrom(repository.readMany([], 'id').pipe(toArray())),
		).resolves.toEqual([[{ id: 'one', timestamp }]]);
		await expect(firstValueFrom(repository.readMany())).resolves.toEqual([
			{ timestamp },
		]);
	});
});
