import { vi } from 'vitest';

interface MockDocRef {
	path: string;
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
}

export interface StaffAdminMock {
	module: {
		apps: unknown[];
		initializeApp: ReturnType<typeof vi.fn>;
		auth: ReturnType<typeof vi.fn>;
		firestore: ReturnType<typeof vi.fn>;
	};
	createUser: ReturnType<typeof vi.fn>;
	getUser: ReturnType<typeof vi.fn>;
	updateUser: ReturnType<typeof vi.fn>;
	deleteUser: ReturnType<typeof vi.fn>;
	setCustomUserClaims: ReturnType<typeof vi.fn>;
	doc: ReturnType<typeof vi.fn>;
	setDocSnapshot: (
		path: string,
		data: Record<string, unknown>,
		exists?: boolean,
	) => void;
	getDocRef: (path: string) => MockDocRef;
	setUserClaims: (uid: string, claims: Record<string, unknown>) => void;
}

export const createStaffAdminMock = (): StaffAdminMock => {
	const docRefs = new Map<string, MockDocRef>();
	const createUser = vi.fn();
	const userClaims = new Map<string, Record<string, unknown>>();
	const getUser = vi.fn(async (uid: string) => ({
		uid,
		customClaims: userClaims.get(uid) ?? { roles: ['checkin'] },
	}));
	const updateUser = vi.fn().mockResolvedValue(undefined);
	const deleteUser = vi.fn().mockResolvedValue(undefined);
	const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
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
			set: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			create: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
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
	const firestore = vi.fn(() => ({ doc }));
	const auth = vi.fn(() => ({
		createUser,
		getUser,
		updateUser,
		deleteUser,
		setCustomUserClaims,
	}));

	return {
		module: {
			apps: [],
			initializeApp,
			auth,
			firestore,
		},
		createUser,
		getUser,
		updateUser,
		deleteUser,
		setCustomUserClaims,
		doc,
		setDocSnapshot,
		getDocRef,
		setUserClaims: (uid, claims): void => {
			userClaims.set(uid, claims);
		},
	};
};

export const loadStaffAdminHandlers = async (
	adminMock: StaffAdminMock,
): Promise<{
	callableCreateStaffUser: typeof import('../../../src/fn/callableCreateStaffUser').default;
	callableUpdateStaffUser: typeof import('../../../src/fn/callableUpdateStaffUser').default;
	callableDeleteStaffUser: typeof import('../../../src/fn/callableDeleteStaffUser').default;
}> => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => adminMock.module);

	const [createModule, updateModule, deleteModule] = await Promise.all([
		import('../../../src/fn/callableCreateStaffUser'),
		import('../../../src/fn/callableUpdateStaffUser'),
		import('../../../src/fn/callableDeleteStaffUser'),
	]);

	return {
		callableCreateStaffUser: createModule.default,
		callableUpdateStaffUser: updateModule.default,
		callableDeleteStaffUser: deleteModule.default,
	};
};
