import { vi } from 'vitest';

export interface FirebaseAdminMock {
	module: {
		initializeApp: ReturnType<typeof vi.fn>;
		auth: ReturnType<typeof vi.fn>;
		firestore: ReturnType<typeof vi.fn>;
		storage: ReturnType<typeof vi.fn>;
	};
	initializeApp: ReturnType<typeof vi.fn>;
	createUser: ReturnType<typeof vi.fn>;
	deleteUser: ReturnType<typeof vi.fn>;
	deleteFile: ReturnType<typeof vi.fn>;
	doc: ReturnType<typeof vi.fn>;
	getDocRef: (path: string) => {
		path: string;
		set: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	batchCreate: ReturnType<typeof vi.fn>;
	batchSet: ReturnType<typeof vi.fn>;
	batchCommit: ReturnType<typeof vi.fn>;
}

export const createFirebaseAdminMock = (): FirebaseAdminMock => {
	const docRefs = new Map<
		string,
		{
			path: string;
			set: ReturnType<typeof vi.fn>;
			delete: ReturnType<typeof vi.fn>;
		}
	>();
	const createUser = vi.fn();
	const deleteUser = vi.fn();
	const deleteFile = vi.fn().mockResolvedValue(undefined);
	const getDocRef = (path: string) => {
		const existing = docRefs.get(path);
		if (existing) {
			return existing;
		}

		const created = {
			path,
			set: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
		};
		docRefs.set(path, created);
		return created;
	};
	const doc = vi.fn((path: string) => getDocRef(path));
	const batchCreate = vi.fn();
	const batchSet = vi.fn();
	const batchCommit = vi.fn();
	const initializeApp = vi.fn();

	const batch = {
		create: batchCreate,
		set: batchSet,
		commit: batchCommit,
	};

	const firestore = vi.fn(() => ({
		doc,
		batch: vi.fn(() => batch),
	}));

	const storage = vi.fn(() => ({
		bucket: vi.fn(() => ({
			file: vi.fn(() => ({
				delete: deleteFile,
			})),
		})),
	}));

	const auth = vi.fn(() => ({
		createUser,
		deleteUser,
	}));

	return {
		module: {
			initializeApp,
			auth,
			firestore,
			storage,
		},
		initializeApp,
		createUser,
		deleteUser,
		deleteFile,
		doc,
		getDocRef,
		batchCreate,
		batchSet,
		batchCommit,
	};
};
