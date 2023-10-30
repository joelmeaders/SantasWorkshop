import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import { firstValueFrom, of } from 'rxjs';
import { FireRepoBase } from './fire-repo-base.service';
import { FirestoreWrapper } from './_firestore-wrapper';

interface TestRecord {
	id?: string;
	name: string;
	category: string;
}

describe('FireRepoBase', () => {
	let service: FireRepoBase;
	let firestoreMethods: jasmine.SpyObj<FirestoreWrapper>;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: true },
			providers: [
				{
					provide: Firestore,
					useValue: jasmine.createSpy('firestoreSpy'),
				},
				{
					provide: FirestoreWrapper,
					useValue: jasmine.createSpyObj<FirestoreWrapper>(
						'firestoreMethodsSpy',
						[
							'collection',
							'doc',
							'docData',
							'rxCollection',
							'query',
							'addDoc',
							'setDoc',
							'deleteDoc',
						],
					),
				},
			],
		});

		service = TestBed.inject(FireRepoBase);
		firestoreMethods = TestBed.inject(
			FirestoreWrapper,
		) as jasmine.SpyObj<FirestoreWrapper>;
	});

	it('randomId(): should make expected calls and return expected result', () => {
		// Arrange
		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const documentSpy = firestoreMethods.doc;
		documentSpy.and.returnValue({
			id: '12345ABCDE',
		} as any);

		// Act
		const response = service.randomId();

		// Assert
		expect(collectionSpy).toHaveBeenCalledOnceWith('_');
		expect(documentSpy).toHaveBeenCalledWith(collectionReference);
		expect(response).toBe('12345ABCDE');
	});

	it('read(): should make expected calls', async () => {
		// Arrange
		const collectionPath = 'test';
		const documentId = '3s87ty4g378by34';
		const idField = 'id';

		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const documentSpy = firestoreMethods.doc;
		const docRefStub = {} as any;
		documentSpy.and.returnValue(docRefStub);

		const docDataSpy = firestoreMethods.docData;
		docDataSpy.and.returnValue(of({} as any));

		// Act
		await firstValueFrom(service.read(collectionPath, documentId, idField));

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith(collectionPath);
		expect(documentSpy).toHaveBeenCalledWith(
			collectionReference,
			documentId,
		);
		expect(docDataSpy).toHaveBeenCalledWith(docRefStub, { idField });
	});

	it('readMany(): should make expected calls and return desired result', async () => {
		// Arrange
		const collectionPath = 'test';
		const queryConstraints = [] as any[];
		const idField = 'id';

		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const querySpy = firestoreMethods.query;
		const queryStub = {} as any;
		querySpy.and.returnValue(queryStub);

		const rxCollectionSpy = firestoreMethods.rxCollection;
		rxCollectionSpy.and.returnValue(
			of([
				{
					id: '1A',
					data: () => ({ name: 'Test 1', category: 'unknown' }),
				},
				{
					id: '2A',
					data: () => ({ name: 'Test 2', category: 'Unit' }),
				},
				{
					id: '2B',
					data: () => ({ name: 'Test 3', category: 'Unit' }),
				},
			] as any),
		);

		// Act
		const result = await firstValueFrom(
			service.readMany<TestRecord>(
				collectionPath,
				queryConstraints,
				idField,
			),
		);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith(collectionPath);
		expect(querySpy).toHaveBeenCalledWith(
			collectionReference,
			queryConstraints,
		);
		expect(rxCollectionSpy).toHaveBeenCalledWith(queryStub);
		expect(result.length).toBe(3);
		expect(result[0].id).toBe('1A');
		expect(result[2].id).toBe('2B');
		expect(result[1].name).toBe('Test 2');
	});

	it('readMany(): should make expected calls and return empty array', async () => {
		// Arrange
		const collectionPath = 'test';
		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const querySpy = firestoreMethods.query;
		const queryStub = {} as any;
		querySpy.and.returnValue(queryStub);

		const rxCollectionSpy = firestoreMethods.rxCollection;
		rxCollectionSpy.and.returnValue(of([] as any));

		// Act
		const result = await firstValueFrom(
			service.readMany<TestRecord>(collectionPath),
		);

		// Assert
		expect(result.length).toBe(0);
	});

	it('add(): should make expected calls', async () => {
		// Arrange
		const collectionPath = 'test';
		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const doc: TestRecord = {
			name: 'Test',
			category: 'Record',
		};

		const addDocSpy = firestoreMethods.addDoc;
		addDocSpy.and.resolveTo({ withConverter() {} } as any);

		// Act
		await firstValueFrom(service.add(collectionPath, doc));

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith(collectionPath);
		expect(addDocSpy).toHaveBeenCalledWith(collectionReference, doc);
	});

	it('addById(): should make expected calls', async () => {
		// Arrange
		const collectionPath = 'test';
		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const doc: TestRecord = {
			id: 'ABC123',
			name: 'Test',
			category: 'Record',
		};

		const documentSpy = firestoreMethods.doc;
		const docRefStub = {} as any;
		documentSpy.and.returnValue(docRefStub);

		const setDocSpy = firestoreMethods.setDoc;
		setDocSpy.and.resolveTo();

		// Act
		await firstValueFrom(service.addById(collectionPath, doc.id!, doc));

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith(collectionPath);
		expect(documentSpy).toHaveBeenCalledWith(collectionReference, doc.id);
		expect(setDocSpy).toHaveBeenCalledWith(docRefStub, doc);
	});

	it('update(): should make expected calls', async () => {
		// Arrange
		const collectionPath = 'test';
		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const doc: TestRecord = {
			id: 'ABC123',
			name: 'Test',
			category: 'Record',
		};

		const documentSpy = firestoreMethods.doc;
		const docRefStub = {} as any;
		documentSpy.and.returnValue(docRefStub);

		const setDocSpy = firestoreMethods.setDoc;
		setDocSpy.and.resolveTo();

		// Act
		await firstValueFrom(
			service.update(collectionPath, doc.id!, doc, true),
		);

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith(collectionPath);
		expect(documentSpy).toHaveBeenCalledWith(collectionReference, doc.id);
		expect(setDocSpy).toHaveBeenCalledWith(docRefStub, doc, {
			merge: true,
		});
	});

	it('delete(): should make expected calls', async () => {
		// Arrange
		const collectionPath = 'test';
		const collectionSpy = firestoreMethods.collection;
		const collectionReference = {} as any;
		collectionSpy.and.returnValue(collectionReference);

		const doc = {
			id: 'ABC123',
		};

		const documentSpy = firestoreMethods.doc;
		const docRefStub = {} as any;
		documentSpy.and.returnValue(docRefStub);

		const deleteDocSpy = firestoreMethods.deleteDoc;
		deleteDocSpy.and.resolveTo({} as any);

		// Act
		await firstValueFrom(service.delete(collectionPath, doc.id!));

		// Assert
		expect(collectionSpy).toHaveBeenCalledWith(collectionPath);
		expect(documentSpy).toHaveBeenCalledWith(collectionReference, doc.id);
		expect(deleteDocSpy).toHaveBeenCalledWith(docRefStub);
	});
});
