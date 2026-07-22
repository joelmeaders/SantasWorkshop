import { TestBed } from '@angular/core/testing';
import { of, firstValueFrom } from 'rxjs';
import { DocumentReference, Query } from 'firebase/firestore';
import { Registration } from '../../../../santashop-models/src';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';
import { FirestoreWrapper } from './_firestore-wrapper';

describe('FireRepoLite', () => {
	let service: FireRepoLite;
	let firestoreWrapper: jasmine.SpyObj<FirestoreWrapper>;

	const mockData = { uid: '12345' } as Registration;
	const collectionReference = { path: 'registrations' } as any;
	const documentReference = {
		id: '12345',
		withConverter: jasmine
			.createSpy('withConverter')
			.and.callFake(() => documentReference),
	} as unknown as DocumentReference<Registration>;
	const queryReference = {} as Query<Registration>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: FirestoreWrapper,
					useValue: jasmine.createSpyObj<FirestoreWrapper>('frb', [
						'collection',
						'collectionQuery',
						'doc',
						'docData',
						'query',
						'addDoc',
						'setDoc',
						'deleteDoc',
					]),
				},
			],
		});

		service = TestBed.inject(FireRepoLite);
		firestoreWrapper = TestBed.inject(
			FirestoreWrapper,
		) as jasmine.SpyObj<FirestoreWrapper>;

		firestoreWrapper.collection.and.returnValue(collectionReference);
		firestoreWrapper.doc.and.returnValue(documentReference);
		firestoreWrapper.query.and.returnValue(queryReference);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('randomId(): should make expected call', () => {
		// Act
		const value = service.randomId();

		// Assert
		expect(value).toEqual('12345');
		expect(firestoreWrapper.collection).toHaveBeenCalledOnceWith('_');
		expect(firestoreWrapper.doc).toHaveBeenCalledWith(collectionReference);
	});

	it('read<T>(): should make expected call', async () => {
		firestoreWrapper.docData.and.returnValue(of(mockData));

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
			jasmine.objectContaining({ idField: 'uid' }) as any,
		);
	});

	it('readMany<T>(): should make expected call', async () => {
		firestoreWrapper.collectionQuery.and.returnValue(of([mockData]));

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
		firestoreWrapper.addDoc.and.resolveTo(documentReference);

		// Act
		const value = await firstValueFrom(
			service.collection<Registration>('registrations').add(mockData),
		);

		// Assert
		expect(value).toEqual(documentReference);
		expect(firestoreWrapper.addDoc).toHaveBeenCalledOnceWith(
			collectionReference,
			mockData,
		);
	});

	it('addById<T>(): should make expected call', async () => {
		firestoreWrapper.setDoc.and.resolveTo();

		// Act
		const value = await firstValueFrom(
			service
				.collection<Registration>('registrations')
				.addById('12345', mockData),
		);

		// Assert
		expect(value).toEqual(documentReference);
		expect(firestoreWrapper.setDoc).toHaveBeenCalledOnceWith(
			documentReference,
			mockData,
		);
	});

	it('update<T>(): should make expected call', async () => {
		firestoreWrapper.setDoc.and.resolveTo();

		// Act
		const value = await firstValueFrom(
			service
				.collection<Registration>('registrations')
				.update('12345', mockData, true),
		);

		// Assert
		expect(value).toEqual(documentReference);
		expect(firestoreWrapper.setDoc).toHaveBeenCalledOnceWith(
			documentReference,
			mockData,
			{ merge: true },
		);
	});

	it('delete(): should make expected call', async () => {
		firestoreWrapper.deleteDoc.and.resolveTo();

		// Act
		await firstValueFrom(
			service.collection<Registration>('registrations').delete('12345'),
		);

		// Assert
		expect(firestoreWrapper.deleteDoc).toHaveBeenCalledOnceWith(
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
			firestoreWrapper.docData.and.returnValue(of(mockData));

			// Act
			const value = await firstValueFrom(collection.read('12345', 'uid'));

			// Assert
			expect(value).toEqual(mockData);
			expect(firestoreWrapper.docData).toHaveBeenCalledWith(
				documentReference,
				jasmine.objectContaining({ idField: 'uid' }) as any,
			);
		});

		it('readMany<T>(): should make expected call', async () => {
			firestoreWrapper.collectionQuery.and.returnValue(of([mockData]));

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
			firestoreWrapper.addDoc.and.resolveTo(documentReference);

			// Act
			const value = await firstValueFrom(collection.add(mockData));

			// Assert
			expect(value).toEqual(documentReference);
			expect(firestoreWrapper.addDoc).toHaveBeenCalledOnceWith(
				collectionReference,
				mockData,
			);
		});

		it('addById<T>(): should make expected call', async () => {
			firestoreWrapper.setDoc.and.resolveTo();

			// Act
			const value = await firstValueFrom(
				collection.addById('12345', mockData),
			);

			// Assert
			expect(value).toEqual(documentReference);
			expect(firestoreWrapper.setDoc).toHaveBeenCalledOnceWith(
				documentReference,
				mockData,
			);
		});

		it('update<T>(): should make expected call', async () => {
			firestoreWrapper.setDoc.and.resolveTo();

			// Act
			const value = await firstValueFrom(
				collection.update('12345', mockData, true),
			);

			// Assert
			expect(value).toEqual(documentReference);
			expect(firestoreWrapper.setDoc).toHaveBeenCalledOnceWith(
				documentReference,
				mockData,
				{ merge: true },
			);
		});

		it('delete(): should make expected call', async () => {
			firestoreWrapper.deleteDoc.and.resolveTo();

			// Act
			await firstValueFrom(collection.delete('12345'));

			// Assert
			expect(firestoreWrapper.deleteDoc).toHaveBeenCalledOnceWith(
				documentReference,
			);
		});
	});
});
