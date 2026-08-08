import { vi } from 'vitest';

interface MockDocRef {
	path: string;
	id: string;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
}

interface MockCollectionRef {
	name: string;
	doc: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
	where: ReturnType<typeof vi.fn>;
	orderBy: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
	offset: ReturnType<typeof vi.fn>;
	count: ReturnType<typeof vi.fn>;
	countGet: ReturnType<typeof vi.fn>;
	add: ReturnType<typeof vi.fn>;
}

interface MockFileRef {
	path: string;
	save: ReturnType<typeof vi.fn>;
	download: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
}

export interface BackgroundAdminMock {
	module: {
		apps: unknown[];
		initializeApp: ReturnType<typeof vi.fn>;
		auth: ReturnType<typeof vi.fn>;
		firestore: ReturnType<typeof vi.fn> & {
			v1: {
				FirestoreAdminClient: new () => {
					databasePath: ReturnType<typeof vi.fn>;
					exportDocuments: ReturnType<typeof vi.fn>;
				};
			};
			Timestamp: {
				fromDate: (date: Date) => { toDate: () => Date };
			};
		};
		storage: ReturnType<typeof vi.fn>;
	};
	doc: ReturnType<typeof vi.fn>;
	collection: ReturnType<typeof vi.fn>;
	batchSet: ReturnType<typeof vi.fn>;
	batchCreate: ReturnType<typeof vi.fn>;
	batchDelete: ReturnType<typeof vi.fn>;
	batchCommit: ReturnType<typeof vi.fn>;
	runTransaction: ReturnType<typeof vi.fn>;
	transactionSet: ReturnType<typeof vi.fn>;
	listUsers: ReturnType<typeof vi.fn>;
	deleteUsers: ReturnType<typeof vi.fn>;
	getUser: ReturnType<typeof vi.fn>;
	updateUser: ReturnType<typeof vi.fn>;
	setCustomUserClaims: ReturnType<typeof vi.fn>;
	upload: ReturnType<typeof vi.fn>;
	getFileRef: (path: string) => MockFileRef;
	setFileContents: (path: string, contents: string) => void;
	databasePath: ReturnType<typeof vi.fn>;
	exportDocuments: ReturnType<typeof vi.fn>;
	getDocRef: (path: string) => MockDocRef;
	getCollectionRef: (name: string) => MockCollectionRef;
	setDocSnapshot: (
		path: string,
		data: Record<string, unknown>,
		exists?: boolean,
	) => void;
	setCollectionDocs: (
		name: string,
		docs: { id: string; data: Record<string, unknown> }[],
	) => void;
	setCollectionCount: (name: string, count: number) => void;
}

const timestampFromDate = (date: Date): { toDate: () => Date } => ({
	toDate: (): Date => date,
});

export const createBackgroundAdminMock = (): BackgroundAdminMock => {
	const docRefs = new Map<string, MockDocRef>();
	const collectionRefs = new Map<string, MockCollectionRef>();
	const fileRefs = new Map<string, MockFileRef>();
	const initializeApp = vi.fn();
	const batchSet = vi.fn();
	const batchCreate = vi.fn();
	const batchDelete = vi.fn();
	const batchCommit = vi.fn();
	const transactionSet = vi.fn(
		(
			ref: MockDocRef,
			value: Record<string, unknown>,
			options?: { merge: boolean },
		) => ref.set(value, options),
	);
	const transactionCreate = vi.fn(
		(
			ref: MockDocRef,
			value: Record<string, unknown>,
		): ReturnType<MockDocRef['create']> => ref.create(value),
	);
	const runTransaction = vi.fn(
		async (
			callback: (transaction: {
				get: (ref: MockDocRef) => Promise<{
					exists: boolean;
					data: () => Record<string, unknown> | undefined;
				}>;
				create: typeof transactionCreate;
				set: typeof transactionSet;
			}) => Promise<void> | void,
		) =>
			callback({
				get: async (ref: MockDocRef) => {
					const snapshot = await ref.get();
					return {
						exists: snapshot.exists,
						data: snapshot.data,
					};
				},
				create: transactionCreate,
				set: transactionSet,
			}),
	);
	const listUsers = vi.fn();
	const deleteUsers = vi.fn();
	const getUser = vi.fn();
	const updateUser = vi.fn();
	const setCustomUserClaims = vi.fn();
	const upload = vi.fn();
	const databasePath = vi.fn();
	const exportDocuments = vi.fn();
	let generatedDocId = 0;

	const getFileRef = (path: string): MockFileRef => {
		const existing = fileRefs.get(path);
		if (existing) {
			return existing;
		}

		const created: MockFileRef = {
			path,
			save: vi.fn().mockImplementation(async (contents: string | Buffer) => {
				const stringContents = Buffer.isBuffer(contents)
					? contents.toString('utf-8')
					: String(contents);
				created.download.mockResolvedValue([
					Buffer.from(stringContents, 'utf-8'),
				]);
			}),
			download: vi.fn().mockResolvedValue([Buffer.from('', 'utf-8')]),
		delete: vi.fn().mockResolvedValue(undefined),
		};
		fileRefs.set(path, created);
		return created;
	};

	const setFileContents = (path: string, contents: string): void => {
		getFileRef(path).download.mockResolvedValue([
			Buffer.from(contents, 'utf-8'),
		]);
	};

	const getDocRef = (path: string): MockDocRef => {
		const existing = docRefs.get(path);
		if (existing) {
			return existing;
		}

		const id = path.split('/').at(-1) ?? `doc-${generatedDocId++}`;
		const created: MockDocRef = {
			path,
			id,
			get: vi.fn().mockResolvedValue({
				exists: false,
				data: () => undefined,
			}),
			set: vi.fn(),
			update: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
		};
		docRefs.set(path, created);
		return created;
	};

	const createCollectionRef = (name: string): MockCollectionRef => {
		const existing = collectionRefs.get(name);
		if (existing) {
			return existing;
		}

		const collectionRef = {} as MockCollectionRef;
		const get = vi.fn();
		const where = vi.fn(() => collectionRef);
		const orderBy = vi.fn(() => collectionRef);
		const limit = vi.fn(() => collectionRef);
		const offset = vi.fn(() => collectionRef);
		const countGet = vi.fn();
		const count = vi.fn(() => ({ get: countGet }));
		const add = vi.fn();
		const doc = vi.fn((id?: string) => {
			const resolvedId = id ?? `generated-${generatedDocId++}`;
			return getDocRef(`${name}/${resolvedId}`);
		});

		Object.assign(collectionRef, {
			name,
			doc,
			get,
			where,
			orderBy,
			limit,
			offset,
			count,
			countGet,
			add,
		});

		collectionRefs.set(name, collectionRef);
		return collectionRef;
	};

	const setDocSnapshot = (
		path: string,
		data: Record<string, unknown>,
		exists = true,
	): void => {
		getDocRef(path).get.mockResolvedValue({
			exists,
			data: () => data,
		});
	};

	const setCollectionDocs = (
		name: string,
		docs: { id: string; data: Record<string, unknown> }[],
	): void => {
		createCollectionRef(name).get.mockResolvedValue({
			empty: docs.length === 0,
			size: docs.length,
			docs: docs.map((entry) => ({
				id: entry.id,
				data: (): Record<string, unknown> => entry.data,
			})),
			forEach: (
				callback: (doc: {
					id: string;
					data: () => Record<string, unknown>;
				}) => void,
			) => {
				docs.forEach((entry) =>
					callback({ id: entry.id, data: () => entry.data }),
				);
			},
		});

		for (const entry of docs) {
			setDocSnapshot(`${name}/${entry.id}`, entry.data, true);
		}
	};

	const setCollectionCount = (name: string, countValue: number): void => {
		createCollectionRef(name).countGet.mockResolvedValue({
			data: (): { count: number } => ({ count: countValue }),
		});
	};

	const doc = vi.fn((path: string) => getDocRef(path));
	const collection = vi.fn((name: string) => createCollectionRef(name));
	const batch = {
		set: batchSet,
		create: batchCreate,
		delete: batchDelete,
		commit: batchCommit,
	};
	const firestoreBase = vi.fn(() => ({
		doc,
		collection,
		batch: vi.fn(() => batch),
		runTransaction,
	}));
	const firestore = Object.assign(firestoreBase, {
		v1: {
			FirestoreAdminClient: class {
				public databasePath = databasePath;
				public exportDocuments = exportDocuments;
			},
		},
		Timestamp: {
			fromDate: timestampFromDate,
		},
	});
	const auth = vi.fn(() => ({
		listUsers,
		deleteUsers,
		getUser,
		updateUser,
		setCustomUserClaims,
	}));
	const storage = vi.fn(() => ({
		bucket: vi.fn(() => ({
			upload,
			file: vi.fn((path: string) => getFileRef(path)),
		})),
	}));

	return {
		module: {
			apps: [],
			initializeApp,
			auth,
			firestore,
			storage,
		},
		doc,
		collection,
		batchSet,
		batchCreate,
		batchDelete,
		batchCommit,
		runTransaction,
		transactionSet,
		listUsers,
		deleteUsers,
		getUser,
		updateUser,
		setCustomUserClaims,
		upload,
		getFileRef,
		setFileContents,
		databasePath,
		exportDocuments,
		getDocRef,
		getCollectionRef: createCollectionRef,
		setDocSnapshot,
		setCollectionDocs,
		setCollectionCount,
	};
};
