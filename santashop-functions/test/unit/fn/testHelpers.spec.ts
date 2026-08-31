import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TestHelpersAdminMock {
	module: {
		apps: unknown[];
		initializeApp: ReturnType<typeof vi.fn>;
		firestore: ReturnType<typeof vi.fn>;
		auth: ReturnType<typeof vi.fn>;
	};
	docSet: ReturnType<typeof vi.fn>;
	batchDelete: ReturnType<typeof vi.fn>;
	batchCommit: ReturnType<typeof vi.fn>;
	listUsers: ReturnType<typeof vi.fn>;
	deleteUser: ReturnType<typeof vi.fn>;
	getFiles: ReturnType<typeof vi.fn>;
	storageDelete: ReturnType<typeof vi.fn>;
	setCollectionDocIds: (name: string, ids: string[]) => void;
}

const createTestHelpersAdminMock = (): TestHelpersAdminMock => {
	const collectionDocs = new Map<string, string[]>();
	const initializeApp = vi.fn();
	const docSet = vi.fn();
	const batchDelete = vi.fn();
	const batchCommit = vi.fn();
	const listUsers = vi.fn();
	const deleteUser = vi.fn();
	const getFiles = vi.fn();
	const storageDelete = vi.fn();

	const collection = vi.fn((name: string) => ({
		doc: vi.fn((id: string) => ({
			path: `${name}/${id}`,
			set: docSet,
		})),
		get: vi.fn(async () => {
			const ids = collectionDocs.get(name) ?? [];
			return {
				docs: ids.map((id) => ({ ref: { path: `${name}/${id}` } })),
				empty: ids.length === 0,
				size: ids.length,
			};
		}),
	}));

	const batch = {
		delete: batchDelete,
		commit: batchCommit,
	};

	return {
		module: {
			apps: [],
			initializeApp,
			firestore: vi.fn(() => ({
				collection,
				batch: vi.fn(() => batch),
			})),
			auth: vi.fn(() => ({
				listUsers,
				deleteUser,
			})),
			storage: vi.fn(() => ({
				bucket: vi.fn(() => ({ getFiles })),
			})),
		},
		docSet,
		batchDelete,
		batchCommit,
		listUsers,
		deleteUser,
		getFiles,
		storageDelete,
		setCollectionDocIds: (name: string, ids: string[]): void => {
			collectionDocs.set(name, ids);
		},
	};
};

const loadSubject = async (
	adminMock: TestHelpersAdminMock,
): Promise<typeof import('../../../src/fn/testHelpers')> => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => adminMock.module);
	return import('../../../src/fn/testHelpers');
};

describe('testHelpers module', () => {
	let adminMock: TestHelpersAdminMock;

	beforeEach(() => {
		adminMock = createTestHelpersAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		adminMock.listUsers.mockResolvedValue({ users: [] });
		adminMock.getFiles.mockResolvedValue([[{ delete: adminMock.storageDelete }]]);
	});

	it('seeds public parameters with defaults merged with overrides', async () => {
		const { seedPublicParameters } = await loadSubject(adminMock);

		await seedPublicParameters({
			registrationEnabled: false,
			messageEn: 'Testing',
		});

		expect(adminMock.docSet).toHaveBeenCalledWith(
			expect.objectContaining({
				registrationEnabled: false,
				messageEn: 'Testing',
				admin: expect.objectContaining({ checkinEnabled: true }),
			}),
		);
	});

	it('clears configured collections and auth users', async () => {
		const { clearAllData } = await loadSubject(adminMock);
		adminMock.setCollectionDocIds('users', ['user-1']);
		adminMock.setCollectionDocIds('registrations', ['reg-1']);
		adminMock.setCollectionDocIds('children', ['child-1']);
		adminMock.setCollectionDocIds('parameters', ['public']);
		adminMock.listUsers.mockResolvedValue({
			users: [{ uid: 'auth-1' }, { uid: 'auth-2' }],
		});

		await clearAllData();

		expect(adminMock.batchDelete).toHaveBeenCalledTimes(4);
		expect(adminMock.batchCommit).toHaveBeenCalledTimes(17);
		expect(adminMock.getFiles).toHaveBeenCalledWith({ prefix: 'registrations/' });
		expect(adminMock.getFiles).toHaveBeenCalledWith({ prefix: 'emailTemplates/' });
		expect(adminMock.storageDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
		expect(adminMock.deleteUser).toHaveBeenCalledWith('auth-1');
		expect(adminMock.deleteUser).toHaveBeenCalledWith('auth-2');
	});

	it('seeds a predefined scenario', async () => {
		const { seedTestScenario } = await loadSubject(adminMock);

		await seedTestScenario('maintenance-mode');

		expect(adminMock.docSet).toHaveBeenLastCalledWith(
			expect.objectContaining({
				registrationEnabled: true,
				createAccountEnabled: true,
				maintenanceModeEnabled: true,
				weatherModeEnabled: false,
			}),
		);
	});
});
