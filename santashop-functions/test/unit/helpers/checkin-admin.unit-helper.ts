import { vi } from 'vitest';

const FORMATTED_DATETIME = 'Thursday, December 11, 6:00 PM';

interface MockDocRef {
	path: string;
	id?: string;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
}

export interface CheckInAdminMock {
	module: {
		apps: unknown[];
		initializeApp: ReturnType<typeof vi.fn>;
		auth: ReturnType<typeof vi.fn>;
		firestore: ReturnType<typeof vi.fn>;
		storage: ReturnType<typeof vi.fn>;
	};
	createUser: ReturnType<typeof vi.fn>;
	deleteUser: ReturnType<typeof vi.fn>;
	deleteFile: ReturnType<typeof vi.fn>;
	doc: ReturnType<typeof vi.fn>;
	collection: ReturnType<typeof vi.fn>;
	runTransaction: ReturnType<typeof vi.fn>;
	transactionGet: ReturnType<typeof vi.fn>;
	transactionCreate: ReturnType<typeof vi.fn>;
	transactionSet: ReturnType<typeof vi.fn>;
	batchCreate: ReturnType<typeof vi.fn>;
	batchSet: ReturnType<typeof vi.fn>;
	batchCommit: ReturnType<typeof vi.fn>;
	setDocSnapshot: (
		path: string,
		data: Record<string, unknown>,
		exists?: boolean,
	) => void;
	getDocRef: (path: string) => MockDocRef;
}

export const generateQrCodeMock = vi.fn();
export const generateIdMock = vi.fn();
export const deleteQrCodeMock = vi.fn().mockResolvedValue(undefined);

export const createCheckInAdminMock = (): CheckInAdminMock => {
	const docRefs = new Map<string, MockDocRef>();
	const createUser = vi.fn();
	const deleteUser = vi.fn();
	const deleteFile = vi.fn().mockResolvedValue(undefined);
	const batchCreate = vi.fn();
	const batchSet = vi.fn();
	const batchCommit = vi.fn();
	const transactionSet = vi.fn(
		(
			ref: MockDocRef,
			value: Record<string, unknown>,
			options?: { merge: boolean },
		) => ref.set(value, options),
	);
	const transactionGet = vi.fn(async (ref: MockDocRef) => ref.get());
	const transactionCreate = vi.fn(
		(ref: MockDocRef, value: Record<string, unknown>) =>
			ref.create(value),
	);
	const runTransaction = vi.fn(
		async (
			callback: (transaction: {
				get: typeof transactionGet;
				create: typeof transactionCreate;
				set: typeof transactionSet;
			}) => Promise<void> | void,
		) =>
			callback({
				get: transactionGet,
				create: transactionCreate,
				set: transactionSet,
			}),
	);
	const initializeApp = vi.fn();

	const getDocRef = (path: string): MockDocRef => {
		const existing = docRefs.get(path);
		if (existing) {
			return existing;
		}

		const created: MockDocRef = {
			path,
			get: vi
				.fn()
				.mockResolvedValue({ exists: false, data: () => undefined }),
			set: vi.fn(),
			update: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
		};
		docRefs.set(path, created);
		return created;
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

	const doc = vi.fn((path: string) => getDocRef(path));
	const collection = vi.fn((name: string) => ({
		doc: vi.fn((id?: string) => {
			if (id) {
				return getDocRef(`${name}/${id}`);
			}

			return { id: 'generated-onsite-id' };
		}),
	}));
	const batch = {
		create: batchCreate,
		set: batchSet,
		commit: batchCommit,
	};
	const firestore = vi.fn(() => ({
		doc,
		collection,
		batch: vi.fn(() => batch),
		runTransaction,
		transactionGet,
		transactionCreate,
		transactionSet,
	}));
	const auth = vi.fn(() => ({
		createUser,
		deleteUser,
	}));
	const storage = vi.fn(() => ({
		bucket: vi.fn(() => ({
			file: vi.fn(() => ({
				delete: deleteFile,
			})),
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
		createUser,
		deleteUser,
		deleteFile,
		doc,
		collection,
		runTransaction,
		transactionGet,
		transactionCreate,
		transactionSet,
		batchCreate,
		batchSet,
		batchCommit,
		setDocSnapshot,
		getDocRef,
	};
};

export const loadCheckInAdminHandlers = async (adminMock: CheckInAdminMock) => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => adminMock.module);
	vi.doMock('dateformat', () => ({
		default: vi.fn(() => FORMATTED_DATETIME),
	}));
	vi.doMock('../../../src/utility/qrcodes', () => ({
		generateQrCode: generateQrCodeMock,
		deleteQrCode: deleteQrCodeMock,
	}));
	vi.doMock('../../../src/utility/id-generation', () => ({
		generateId: generateIdMock,
	}));

	const [
		checkInModule,
		checkInWithEditModule,
		onSiteRegistrationModule,
		callableAdminPreRegisterModule,
		callableResendRegistrationEmailModule,
	] = await Promise.all([
		import('../../../src/fn/checkIn'),
		import('../../../src/fn/checkInWithEdit'),
		import('../../../src/fn/onSiteRegistration'),
		import('../../../src/fn/callableAdminPreRegister'),
		import('../../../src/fn/callableResendRegistrationEmail'),
	]);

	return {
		checkIn: checkInModule.default,
		checkInWithEdit: checkInWithEditModule.default,
		onSiteRegistration: onSiteRegistrationModule.default,
		callableAdminPreRegister: callableAdminPreRegisterModule.default,
		callableResendRegistrationEmail:
			callableResendRegistrationEmailModule.default,
	};
};
