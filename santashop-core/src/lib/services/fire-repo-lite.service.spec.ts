import { TestBed } from '@angular/core/testing';
import { FireRepoBase } from './fire-repo-base.service';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';
import {
	Firestore,
	DocumentReference,
	DocumentData,
} from '@angular/fire/firestore';
import { IRegistration } from '@models/*';
import { of } from 'rxjs';

describe('FireRepoLite', () => {
	let service: FireRepoLite;
	let fireRepoBase: FireRepoBase;

	const mockData = { uid: '12345' } as IRegistration;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				{ provide: FireRepoBase },
				{ provide: Firestore, useValue: jasmine.createSpy('fs') },
			],
		});

		service = TestBed.inject(FireRepoLite);
		fireRepoBase = TestBed.inject(FireRepoBase);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('randomId(): should make expected call', () => {
		// Arrange
		const spy = spyOn(fireRepoBase, 'randomId').and.returnValue('12345');

		// Act
		const value = service.randomId();

		// Assert
		expect(value).toEqual('12345');
		expect(spy).toHaveBeenCalled();
	});

	it('read<T>(): should make expected call', async () => {
		// Arrange
		const spy = spyOn(fireRepoBase, 'read').and.returnValue(of(mockData));

		// Act
		service.read<IRegistration>('registrations', '12345', 'uid');

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			'12345',
			<any>'uid'
		);
	});

	it('readMany<T>(): should make expected call', async () => {
		// Arrange
		const spy = spyOn(fireRepoBase, 'readMany').and.returnValue(
			of([mockData])
		);

		// Act
		service.readMany<IRegistration>('registrations', undefined, 'uid');

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			undefined,
			<any>'uid'
		);
	});

	it('add<T>(): should make expected call', async () => {
		// Arrange
		const spy = spyOn(fireRepoBase, 'add').and.returnValue(
			of({} as DocumentReference<IRegistration>)
		);

		// Act
		service.add('registrations', mockData);

		// Assert
		expect(spy).toHaveBeenCalledOnceWith('registrations', mockData);
	});

	it('addById<T>(): should make expected call', async () => {
		// Arrange
		const spy = spyOn(fireRepoBase, 'addById').and.returnValue(
			of({} as DocumentReference<IRegistration>)
		);

		// Act
		service.addById('registrations', '12345', mockData);

		// Assert
		expect(spy).toHaveBeenCalledOnceWith(
			'registrations',
			'12345',
			mockData
		);
	});

	it('update<T>(): should make expected call', async () => {
		// Arrange
		const spy = spyOn(fireRepoBase, 'update').and.returnValue(
			of({} as DocumentReference<DocumentData>)
		);

		// Act
		service.update('registrations', '12345', mockData, true);

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
		const spy = spyOn(fireRepoBase, 'delete').and.returnValue(of());

		// Act
		service.delete('registrations', '12345');

		// Assert
		expect(spy).toHaveBeenCalledOnceWith('registrations', '12345');
	});

	describe('collection<T>()', () => {
		let collection: IFireRepoCollection<IRegistration>;

		beforeEach(() => {
			collection = service.collection<IRegistration>('registrations');
		});

		it('should return collection with matching collectionPathName', () => {
			// Assert
			expect(collection.collectionPathName).toEqual('registrations');
		});

		it('read<T>(): should make expected call', async () => {
			// Arrange
			const spy = spyOn(fireRepoBase, 'read').and.returnValue(
				of(mockData)
			);

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
			const spy = spyOn(fireRepoBase, 'readMany').and.returnValue(
				of([mockData])
			);

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
			const spy = spyOn(fireRepoBase, 'add').and.returnValue(
				of({} as DocumentReference<IRegistration>)
			);

			// Act
			collection.add(mockData);

			// Assert
			expect(spy).toHaveBeenCalledOnceWith('registrations', mockData);
		});

		it('addById<T>(): should make expected call', async () => {
			// Arrange
			const spy = spyOn(fireRepoBase, 'addById').and.returnValue(
				of({} as DocumentReference<IRegistration>)
			);

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
			const spy = spyOn(fireRepoBase, 'update').and.returnValue(
				of({} as DocumentReference<DocumentData>)
			);

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
			const spy = spyOn(fireRepoBase, 'delete').and.returnValue(of());

			// Act
			collection.delete('12345');

			// Assert
			expect(spy).toHaveBeenCalledOnceWith('registrations', '12345');
		});
	});
});
