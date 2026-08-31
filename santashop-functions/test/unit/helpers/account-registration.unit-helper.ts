import { vi } from 'vitest';

const FORMATTED_DATETIME = 'Wednesday, December 10, 6:00 PM';

interface MockDocRef {
	path: string;
	collection: (path: string) => { doc: (id: string) => MockDocRef };
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
	transactionSet: ReturnType<typeof vi.fn>;
	transactionCreate: ReturnType<typeof vi.fn>;
	transactionUpdate: ReturnType<typeof vi.fn>;
	transactionDelete: ReturnType<typeof vi.fn>;
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
	const transactionCreate = vi.fn();
	const transactionUpdate = vi.fn();
	const transactionDelete = vi.fn();
	const transactionGet = vi.fn((reference: MockDocRef) => reference.get());
	const runTransaction = vi.fn(
		async (
			callback: (transaction: {
				set: typeof transactionSet;
				create: typeof transactionCreate;
				get: typeof transactionGet;
				update: typeof transactionUpdate;
				delete: typeof transactionDelete;
			}) => Promise<void> | void,
		) =>
			callback({
				set: transactionSet,
				create: transactionCreate,
				get: transactionGet,
				update: transactionUpdate,
				delete: transactionDelete,
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
			collection: (subcollection: string) => ({
				doc: (id: string) => getDocRef(`${path}/${subcollection}/${id}`),
			}),
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
	const collection = vi.fn((path: string) => ({
		doc: vi.fn((id?: string) => getDocRef(`${path}/${id ?? 'generated-id'}`)),
	}));
	const batch = {
		set: batchSet,
		create: batchCreate,
		delete: batchDelete,
		commit: batchCommit,
	};
	const firestore = vi.fn(() => ({
		doc,
		collection,
		batch: vi.fn(() => batch),
		runTransaction,
	}));
	Object.assign(firestore, {
		FieldValue: { delete: vi.fn(() => '__deleted__') },
	});
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
		transactionSet,
		transactionCreate,
		transactionUpdate,
		transactionDelete,
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
	vi.doMock('../../../src/utility/qrcodes', () => ({
		deleteQrCode: vi.fn().mockResolvedValue(undefined),
		generateQrCode: vi.fn().mockResolvedValue(undefined),
		createQrCodeStoragePath: vi.fn(
			(uid: string) => `registrations/${uid}/replacement.png`,
		),
		replaceQrCodeWithCancelled: vi.fn().mockResolvedValue(undefined),
	}));

	const [
		changeAccountInformationModule,
		updateReferredByModule,
		completeRegistrationModule,
		saveDraftChildModule,
		deleteDraftChildModule,
		setDraftAppointmentModule,
		undoRegistrationModule,
		changeRegistrationDateTimeModule,
		updateEmailAddressModule,
	] = await Promise.all([
		import('../../../src/fn/changeAccountInformation'),
		import('../../../src/fn/updateReferredBy'),
		import('../../../src/fn/completeRegistration'),
		import('../../../src/fn/saveDraftChild'),
		import('../../../src/fn/deleteDraftChild'),
		import('../../../src/fn/setDraftAppointment'),
		import('../../../src/fn/undoRegistration'),
		import('../../../src/fn/changeRegistrationDateTime'),
		import('../../../src/fn/updateEmailAddress'),
	]);

	return {
		changeAccountInformation: changeAccountInformationModule.default,
		updateReferredBy: updateReferredByModule.default,
		completeRegistration: completeRegistrationModule.default,
		saveDraftChild: saveDraftChildModule.default,
		deleteDraftChild: deleteDraftChildModule.default,
		setDraftAppointment: setDraftAppointmentModule.default,
		undoRegistration: undoRegistrationModule.default,
		changeRegistrationDateTime: changeRegistrationDateTimeModule.default,
		updateEmailAddress: updateEmailAddressModule.default,
	};
};
