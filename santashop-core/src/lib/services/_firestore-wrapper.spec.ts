import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	setDoc,
	type CollectionReference,
	type DocumentReference,
	type DocumentSnapshot,
	type Firestore,
	type Query,
	type QuerySnapshot,
} from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_FIRESTORE } from '../tokens';
import { FirestoreWrapper, timestampDateFix } from './_firestore-wrapper';

vi.mock('firebase/firestore', () => ({
	addDoc: vi.fn(),
	collection: vi.fn(),
	deleteDoc: vi.fn(),
	doc: vi.fn(),
	onSnapshot: vi.fn(),
	query: vi.fn(),
	setDoc: vi.fn(),
	Timestamp: class {
		public static readonly fromDate = vi.fn((date: Date) => ({
			toDate: (): Date => date,
		}));
	},
}));

interface RecordData {
	id?: string;
	name: string;
}

describe('FirestoreWrapper', () => {
	let service: FirestoreWrapper;
	const firestore = {} as Firestore;
	const collectionRef = {} as CollectionReference<RecordData>;
	const documentRef = {} as DocumentReference<RecordData>;
	const queryRef = {} as Query<RecordData>;

	beforeEach(() => {
		for (const mock of [addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc]) {
			vi.mocked(mock).mockReset();
		}
		TestBed.configureTestingModule({
			providers: [
				{ provide: FIREBASE_FIRESTORE, useValue: firestore },
				{
					provide: NgZone,
					useValue: { run: <T>(action: () => T): T => action() },
				},
			],
		});
		service = TestBed.inject(FirestoreWrapper);
	});

	it('normalizes Firestore timestamps and leaves native dates intact', () => {
		const converted = new Date('2026-12-01T00:00:00Z');
		expect(timestampDateFix({ toDate: () => converted } as unknown as Date)).toBe(
			converted,
		);
		const native = new Date('2026-12-02T00:00:00Z');
		expect(timestampDateFix(native)).toBe(native);
	});

	it('creates collection, document, and query references', () => {
		vi.mocked(collection).mockReturnValue(collectionRef);
		vi.mocked(doc).mockReturnValue(documentRef);
		vi.mocked(query).mockReturnValue(queryRef);

		expect(service.collection<RecordData>('records')).toBe(collectionRef);
		expect(service.doc(collectionRef, 'one')).toBe(documentRef);
		expect(service.doc(collectionRef)).toBe(documentRef);
		expect(service.query(collectionRef)).toBe(queryRef);
		expect(service.query(collectionRef, [{} as never])).toBe(queryRef);

		expect(collection).toHaveBeenCalledWith(firestore, 'records');
		expect(doc).toHaveBeenNthCalledWith(1, collectionRef, 'one');
		expect(doc).toHaveBeenNthCalledWith(2, collectionRef);
		expect(query).toHaveBeenNthCalledWith(1, collectionRef);
		expect(query).toHaveBeenNthCalledWith(2, collectionRef, {});
	});

	it('maps collection snapshots with and without document ids', async () => {
		const snapshot = {
			docs: [
				{ id: 'one', data: (): RecordData => ({ name: 'First' }) },
				{ id: 'two', data: (): RecordData => ({ name: 'Second' }) },
			],
		} as unknown as QuerySnapshot<RecordData>;
		vi.mocked(onSnapshot).mockImplementation((_, next) => {
			(next as (value: QuerySnapshot<RecordData>) => void)(snapshot);
			return vi.fn();
		});

		await expect(firstValueFrom(service.collectionQuery(queryRef))).resolves.toEqual([
			{ name: 'First' },
			{ name: 'Second' },
		]);
		await expect(
			firstValueFrom(service.collectionQuery(queryRef, 'id')),
		).resolves.toEqual([
			{ id: 'one', name: 'First' },
			{ id: 'two', name: 'Second' },
		]);
	});

	it('forwards collection subscription errors', async () => {
		const expected = new Error('collection failed');
		vi.mocked(onSnapshot).mockImplementation((_, __, error) => {
			(error as unknown as (value: Error) => void)(expected);
			return vi.fn();
		});

		await expect(firstValueFrom(service.collectionQuery(queryRef))).rejects.toBe(
			expected,
		);
	});

	it.each([
		[false, undefined, undefined, undefined],
		[true, undefined, undefined, undefined],
		[true, { name: 'First' }, { name: 'First' }, undefined],
		[true, { name: 'First' }, { id: 'one', name: 'First' }, 'id'],
	] as const)(
		'maps document snapshots (exists=%s, data=%s)',
		async (exists, data, expected, idField) => {
			const snapshot = {
				id: 'one',
				exists: () => exists,
				data: () => data,
			} as unknown as DocumentSnapshot<RecordData>;
			vi.mocked(onSnapshot).mockImplementation((_, next) => {
				(next as (value: DocumentSnapshot<RecordData>) => void)(snapshot);
				return vi.fn();
			});

			await expect(
				firstValueFrom(
					service.docData(
						documentRef,
						idField ? { idField } : undefined,
					),
				),
			).resolves.toEqual(expected);
		},
	);

	it('forwards document subscription errors', async () => {
		const expected = new Error('document failed');
		vi.mocked(onSnapshot).mockImplementation((_, __, error) => {
			(error as unknown as (value: Error) => void)(expected);
			return vi.fn();
		});

		await expect(firstValueFrom(service.docData(documentRef))).rejects.toBe(
			expected,
		);
	});

	it('forwards document writes and deletes, with optional set options', async () => {
		vi.mocked(addDoc).mockResolvedValue(documentRef);
		vi.mocked(setDoc).mockResolvedValue(undefined);
		vi.mocked(deleteDoc).mockResolvedValue(undefined);
		const value = { name: 'First' };

		await expect(service.addDoc(collectionRef, value)).resolves.toBe(documentRef);
		await service.setDoc(documentRef, value);
		await service.setDoc(documentRef, value, { merge: true });
		await service.deleteDoc(documentRef);

		expect(addDoc).toHaveBeenCalledWith(collectionRef, value);
		expect(setDoc).toHaveBeenNthCalledWith(1, documentRef, value);
		expect(setDoc).toHaveBeenNthCalledWith(2, documentRef, value, {
			merge: true,
		});
		expect(deleteDoc).toHaveBeenCalledWith(documentRef);
	});
});
