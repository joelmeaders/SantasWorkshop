import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import type { DocumentReference, Query } from 'firebase/firestore';
import { Registration } from '../../../../santashop-models/src';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';
import { FirestoreWrapper } from './_firestore-wrapper';

vi.mock('firebase/firestore', () => ({
	addDoc: vi.fn(),
	collection: vi.fn(),
	deleteDoc: vi.fn(),
	doc: vi.fn(),
	onSnapshot: vi.fn(),
	query: vi.fn(),
	setDoc: vi.fn(),
	Timestamp: class {},
}));

describe('FireRepoLite', () => {
	let service: FireRepoLite;
	let firestoreWrapper: Mocked<FirestoreWrapper>;

	const mockData = { uid: '12345' } as Registration;
	const collectionReference = { path: 'registrations' } as any;
	const documentReference = {
		id: '12345',
		withConverter: vi
			.fn()
			.mockName('withConverter')
			.mockImplementation(() => documentReference),
	} as unknown as DocumentReference<Registration>;
	const queryReference = {} as Query<Registration>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: FirestoreWrapper,
					useValue: {
						collection: vi.fn().mockName('frb.collection'),
						collectionQuery: vi
							.fn()
							.mockName('frb.collectionQuery'),
						doc: vi.fn().mockName('frb.doc'),
						docData: vi.fn().mockName('frb.docData'),
						query: vi.fn().mockName('frb.query'),
						addDoc: vi.fn().mockName('frb.addDoc'),
						setDoc: vi.fn().mockName('frb.setDoc'),
						deleteDoc: vi.fn().mockName('frb.deleteDoc'),
					},
				},
			],
		});

		service = TestBed.inject(FireRepoLite);
		firestoreWrapper = TestBed.inject(
			FirestoreWrapper,
		) as Mocked<FirestoreWrapper>;

		firestoreWrapper.collection.mockReturnValue(collectionReference);
		firestoreWrapper.doc.mockReturnValue(documentReference);
		firestoreWrapper.query.mockReturnValue(queryReference);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('randomId(): should make expected call', () => {
		// Act
		const value = service.randomId();

		// Assert
		expect(value).toEqual('12345');
		expect(firestoreWrapper.collection).toHaveBeenCalledTimes(1);
		expect(firestoreWrapper.collection).toHaveBeenCalledWith('_');
		expect(firestoreWrapper.doc).toHaveBeenCalledWith(collectionReference);
	});

	it('read<T>(): should make expected call', async () => {
		firestoreWrapper.docData.mockReturnValue(of(mockData));

		// Act
		const value = await firstValueFrom(
			service
				.collection<Registration>('registrations')
				.read('12345', 'uid'),
		);

		// Assert
		expect(value).toEqual(mockData);
		expect(firestoreWrapper.collection).toHaveBeenCalledWith(
			'registrations',
		);
		expect(firestoreWrapper.doc).toHaveBeenCalledWith(
			collectionReference,
			'12345',
		);
		expect(firestoreWrapper.docData).toHaveBeenCalledWith(
			documentReference,
			expect.objectContaining({ idField: 'uid' }) as any,
		);
	});

	it('readMany<T>(): should make expected call', async () => {
		firestoreWrapper.collectionQuery.mockReturnValue(of([mockData]));

		// Act
		const value = await firstValueFrom(
			service
				.collection<Registration>('registrations')
				.readMany(undefined, 'uid'),
		);

		// Assert
		expect(value).toEqual([mockData]);
		expect(firestoreWrapper.query).toHaveBeenCalledWith(
			collectionReference,
		);
		expect(firestoreWrapper.collectionQuery).toHaveBeenCalledWith(
			queryReference,
			'uid' as any,
		);
	});

	it('add<T>(): should make expected call', async () => {
		firestoreWrapper.addDoc.mockResolvedValue(documentReference);

		// Act
		const value = await firstValueFrom(
			service.collection<Registration>('registrations').add(mockData),
		);

		// Assert
		expect(value).toEqual(documentReference);
		expect(firestoreWrapper.addDoc).toHaveBeenCalledTimes(1);
		expect(firestoreWrapper.addDoc).toHaveBeenCalledWith(
			collectionReference,
			mockData,
		);
	});

	it('addById<T>(): should make expected call', async () => {
		firestoreWrapper.setDoc.mockResolvedValue(undefined);

		// Act
		const value = await firstValueFrom(
			service
				.collection<Registration>('registrations')
				.addById('12345', mockData),
		);

		// Assert
		expect(value).toEqual(documentReference);
		expect(firestoreWrapper.setDoc).toHaveBeenCalledTimes(1);
		expect(firestoreWrapper.setDoc).toHaveBeenCalledWith(
			documentReference,
			mockData,
		);
	});

	it('update<T>(): should make expected call', async () => {
		firestoreWrapper.setDoc.mockResolvedValue(undefined);

		// Act
		const value = await firstValueFrom(
			service
				.collection<Registration>('registrations')
				.update('12345', mockData, true),
		);

		// Assert
		expect(value).toEqual(documentReference);
		expect(firestoreWrapper.setDoc).toHaveBeenCalledTimes(1);
		expect(firestoreWrapper.setDoc).toHaveBeenCalledWith(
			documentReference,
			mockData,
			{ merge: true },
		);
	});

	it('delete(): should make expected call', async () => {
		firestoreWrapper.deleteDoc.mockResolvedValue(undefined);

		// Act
		await firstValueFrom(
			service.collection<Registration>('registrations').delete('12345'),
		);

		// Assert
		expect(firestoreWrapper.deleteDoc).toHaveBeenCalledTimes(1);

		// Assert
		expect(firestoreWrapper.deleteDoc).toHaveBeenCalledWith(
			documentReference,
		);
	});

	describe('collection<T>()', () => {
		let collection: IFireRepoCollection<Registration>;

		beforeEach(() => {
			collection = service.collection<Registration>('registrations');
		});

		it('should return collection with matching collectionPathName', () => {
			// Assert
			expect(collection.collectionPathName).toEqual('registrations');
		});

		it('read<T>(): should make expected call', async () => {
			firestoreWrapper.docData.mockReturnValue(of(mockData));

			// Act
			const value = await firstValueFrom(collection.read('12345', 'uid'));

			// Assert
			expect(value).toEqual(mockData);
			expect(firestoreWrapper.docData).toHaveBeenCalledWith(
				documentReference,
				expect.objectContaining({ idField: 'uid' }) as any,
			);
		});

		it('readMany<T>(): should make expected call', async () => {
			firestoreWrapper.collectionQuery.mockReturnValue(of([mockData]));

			// Act
			const value = await firstValueFrom(
				collection.readMany(undefined, 'uid'),
			);

			// Assert
			expect(value).toEqual([mockData]);
			expect(firestoreWrapper.collectionQuery).toHaveBeenCalledWith(
				queryReference,
				'uid' as any,
			);
		});

		it('add<T>(): should make expected call', async () => {
			firestoreWrapper.addDoc.mockResolvedValue(documentReference);

			// Act
			const value = await firstValueFrom(collection.add(mockData));

			// Assert
			expect(value).toEqual(documentReference);
			expect(firestoreWrapper.addDoc).toHaveBeenCalledTimes(1);
			expect(firestoreWrapper.addDoc).toHaveBeenCalledWith(
				collectionReference,
				mockData,
			);
		});

		it('addById<T>(): should make expected call', async () => {
			firestoreWrapper.setDoc.mockResolvedValue(undefined);

			// Act
			const value = await firstValueFrom(
				collection.addById('12345', mockData),
			);

			// Assert
			expect(value).toEqual(documentReference);
			expect(firestoreWrapper.setDoc).toHaveBeenCalledTimes(1);
			expect(firestoreWrapper.setDoc).toHaveBeenCalledWith(
				documentReference,
				mockData,
			);
		});

		it('update<T>(): should make expected call', async () => {
			firestoreWrapper.setDoc.mockResolvedValue(undefined);

			// Act
			const value = await firstValueFrom(
				collection.update('12345', mockData, true),
			);

			// Assert
			expect(value).toEqual(documentReference);
			expect(firestoreWrapper.setDoc).toHaveBeenCalledTimes(1);
			expect(firestoreWrapper.setDoc).toHaveBeenCalledWith(
				documentReference,
				mockData,
				{ merge: true },
			);
		});

		it('delete(): should make expected call', async () => {
			firestoreWrapper.deleteDoc.mockResolvedValue(undefined);

			// Act
			await firstValueFrom(collection.delete('12345'));

			// Assert
			expect(firestoreWrapper.deleteDoc).toHaveBeenCalledTimes(1);

			// Assert
			expect(firestoreWrapper.deleteDoc).toHaveBeenCalledWith(
				documentReference,
			);
		});
	});
});
