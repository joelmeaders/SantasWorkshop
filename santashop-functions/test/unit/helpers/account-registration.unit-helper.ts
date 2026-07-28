import { vi } from 'vitest';

const FORMATTED_DATETIME = 'Wednesday, December 10, 6:00 PM';

interface MockDocRef {
	path: string;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
}

export interface AccountAdminMock {
	module: {
		apps: unknown[];
		initializeApp: ReturnType<typeof vi.fn>;
		auth: ReturnType<typeof vi.fn>;
		firestore: ReturnType<typeof vi.fn>;
	};
	updateUser: ReturnType<typeof vi.fn>;
	doc: ReturnType<typeof vi.fn>;
	runTransaction: ReturnType<typeof vi.fn>;
	batchSet: ReturnType<typeof vi.fn>;
	batchCreate: ReturnType<typeof vi.fn>;
	batchDelete: ReturnType<typeof vi.fn>;
	batchCommit: ReturnType<typeof vi.fn>;
	setDocSnapshot: (
		path: string,
		data: Record<string, unknown>,
		exists?: boolean,
	) => void;
	getDocRef: (path: string) => MockDocRef;
}

export const createAccountAdminMock = (): AccountAdminMock => {
	const docRefs = new Map<string, MockDocRef>();
	const updateUser = vi.fn();
	const batchSet = vi.fn();
	const batchCreate = vi.fn();
	const batchDelete = vi.fn();
	const batchCommit = vi.fn();
	const transactionSet = vi.fn();
	const runTransaction = vi.fn(
		async (
			callback: (transaction: {
				set: typeof transactionSet;
			}) => Promise<void> | void,
		) => callback({ set: transactionSet }),
	);
	const initializeApp = vi.fn();

	const getDocRef = (path: string): MockDocRef => {
		const existing = docRefs.get(path);
		if (existing) {
			return existing;
		}

		const created: MockDocRef = {
			path,
			get: vi.fn(),
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
	const batch = {
		set: batchSet,
		create: batchCreate,
		delete: batchDelete,
		commit: batchCommit,
	};
	const firestore = vi.fn(() => ({
		doc,
		batch: vi.fn(() => batch),
		runTransaction,
	}));
	const auth = vi.fn(() => ({
		updateUser,
	}));

	return {
		module: {
			apps: [],
			initializeApp,
			auth,
			firestore,
		},
		updateUser,
		doc,
		runTransaction,
		batchSet,
		batchCreate,
		batchDelete,
		batchCommit,
		setDocSnapshot,
		getDocRef,
	};
};

export const loadAccountRegistrationHandlers = async (
	adminMock: AccountAdminMock,
) => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => adminMock.module);
	vi.doMock('dateformat', () => ({
		default: vi.fn(() => FORMATTED_DATETIME),
	}));

	const [
		changeAccountInformationModule,
		updateReferredByModule,
		completeRegistrationModule,
		undoRegistrationModule,
		changeRegistrationDateTimeModule,
		updateEmailAddressModule,
	] = await Promise.all([
		import('../../../src/fn/changeAccountInformation'),
		import('../../../src/fn/updateReferredBy'),
		import('../../../src/fn/completeRegistration'),
		import('../../../src/fn/undoRegistration'),
		import('../../../src/fn/changeRegistrationDateTime'),
		import('../../../src/fn/updateEmailAddress'),
	]);

	return {
		changeAccountInformation: changeAccountInformationModule.default,
		updateReferredBy: updateReferredByModule.default,
		completeRegistration: completeRegistrationModule.default,
		undoRegistration: undoRegistrationModule.default,
		changeRegistrationDateTime: changeRegistrationDateTimeModule.default,
		updateEmailAddress: updateEmailAddressModule.default,
	};
};
