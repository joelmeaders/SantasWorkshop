import { TestBed } from '@angular/core/testing';
import { FireRepoBase } from './fire-repo-base.service';
import { Registration } from '../../../../santashop-models/src/public-api';
import { of } from 'rxjs';
import { DocumentData, DocumentReference } from './_firestore-wrapper';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';
import { Firestore } from '@angular/fire/firestore';

describe('FireRepoLite', () => {
	let service: FireRepoLite;
	let fireRepoBase: jasmine.SpyObj<FireRepoBase>;

	const mockData = { uid: '12345' } as Registration;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{
					provide: FireRepoBase,
					useValue: jasmine.createSpyObj<FireRepoBase>('frb', [
						'delete',
						'randomId',
						'addById',
						'read',
						'add',
						'update',
						'readMany',
					]),
				},
				{ provide: Firestore, useValue: jasmine.createSpy('fs') },
			],
		});

		service = TestBed.inject(FireRepoLite);
		fireRepoBase = TestBed.inject(
			FireRepoBase
		) as jasmine.SpyObj<FireRepoBase>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('randomId(): should make expected call', () => {
		// Arrange
		const spy = fireRepoBase.randomId;

		spy.and.returnValue('12345');

		// Act
		const value = service.randomId();

		// Assert
		expect(value).toEqual('12345');
		expect(spy).toHaveBeenCalled();
	});

	it('read<T>(): should make expected call', async () => {
		// Arrange
		const spy = fireRepoBase.read;

		spy.and.returnValue(of(mockData));

		// Act
		service.collection<Registration>('registrations').read('12345', 'uid');

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			'12345',
			<any>'uid'
		);
	});

	it('readMany<T>(): should make expected call', async () => {
		// Arrange
		const spy = fireRepoBase.readMany;

		spy.and.returnValue(of([mockData]));

		// Act
		service
			.collection<Registration>('registrations')
			.readMany(undefined, 'uid');

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			undefined,
			<any>'uid'
		);
	});

	it('add<T>(): should make expected call', async () => {
		// Arrange
		const spy = fireRepoBase.add;

		spy.and.returnValue(of({} as DocumentReference<Registration>));

		// Act
		service.collection<Registration>('registrations').add(mockData);

		// Assert
		expect(spy).toHaveBeenCalledOnceWith('registrations', mockData);
	});

	it('addById<T>(): should make expected call', async () => {
		// Arrange
		const spy = fireRepoBase.addById;

		spy.and.returnValue(of({} as DocumentReference<Registration>));

		// Act
		service
			.collection<Registration>('registrations')
			.addById('12345', mockData);

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			'12345',
			mockData
		);
	});

	it('update<T>(): should make expected call', async () => {
		// Arrange
		const spy = fireRepoBase.update;

		spy.and.returnValue(of({} as DocumentReference<DocumentData>));

		// Act
		service
			.collection<Registration>('registrations')
			.update('12345', mockData, true);

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			'12345',
			mockData,
			true
		);
	});

	it('delete(): should make expected call', async () => {
		// Arrange
		const spy = fireRepoBase.delete;

		spy.and.returnValue(of());

		// Act
		service.collection<Registration>('registrations').delete('12345');

		// Assert
		expect(spy).toHaveBeenCalledOnceWith('registrations', '12345');
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
			// Arrange
			const spy = fireRepoBase.read;

			spy.and.returnValue(of(mockData));

			// Act
			collection.read('12345', 'uid');

			// Assert
			expect(spy).toHaveBeenCalledOnceWith(
				'registrations',
				'12345',
				<any>'uid'
			);
		});

		it('readMany<T>(): should make expected call', async () => {
			// Arrange
			const spy = fireRepoBase.readMany;

			spy.and.returnValue(of([mockData]));

			// Act
			collection.readMany(undefined, 'uid');

			// Assert
			expect(spy).toHaveBeenCalledOnceWith(
				'registrations',
				undefined,
				<any>'uid'
			);
		});

		it('add<T>(): should make expected call', async () => {
			// Arrange
			const spy = fireRepoBase.add;

			spy.and.returnValue(of({} as DocumentReference<Registration>));

			// Act
			collection.add(mockData);

			// Assert
			expect(spy).toHaveBeenCalledOnceWith('registrations', mockData);
		});

		it('addById<T>(): should make expected call', async () => {
			// Arrange
			const spy = fireRepoBase.addById;

			spy.and.returnValue(of({} as DocumentReference<Registration>));

			// Act
			collection.addById('12345', mockData);

			// Assert
			expect(spy).toHaveBeenCalledOnceWith(
				'registrations',
				'12345',
				mockData
			);
		});

		it('update<T>(): should make expected call', async () => {
			// Arrange
			const spy = fireRepoBase.update;

			spy.and.returnValue(of({} as DocumentReference<DocumentData>));

			// Act
			collection.update('12345', mockData, true);

			// Assert
			expect(spy).toHaveBeenCalledOnceWith(
				'registrations',
				'12345',
				mockData,
				true
			);
		});

		it('delete(): should make expected call', async () => {
			// Arrange
			const spy = fireRepoBase.delete;

			spy.and.returnValue(of());

			// Act
			collection.delete('12345');

			// Assert
			expect(spy).toHaveBeenCalledOnceWith('registrations', '12345');
		});
	});
});
