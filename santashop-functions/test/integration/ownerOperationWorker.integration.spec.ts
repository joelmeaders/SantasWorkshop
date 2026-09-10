import { beforeEach, describe, expect, it } from 'vitest';
import ownerOperationWorker from '../../src/fn/ownerOperationWorker';
import { clearEmulatorData, getFirestore } from '../helpers/admin-emulator';

describe.sequential('owner operation terminal lock cleanup integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it.each([
		{ status: 'failed', stage: 'backup-timeout' },
		{ status: 'succeeded', stage: 'completed' },
	])('releases only its own lock for $stage', async ({ status, stage }) => {
		const db = getFirestore();
		const operation = db.doc('ownerOperations/finished-reset');
		const lock = db.doc('ownerOperationLocks/yearly-reset');
		await operation.set({ operation: 'yearly-reset', status, stage });
		await lock.set({ operationId: 'finished-reset' });
		await ownerOperationWorker({ data: { operationId: 'finished-reset' } });
		expect((await lock.get()).exists).toBe(false);
		expect((await operation.get()).data()).toEqual({
			operation: 'yearly-reset',
			status,
			stage,
		});
		// A replay after cleanup also acknowledges without restarting the operation.
		await ownerOperationWorker({ data: { operationId: 'finished-reset' } });
		expect((await operation.get()).data()).toEqual({
			operation: 'yearly-reset',
			status,
			stage,
		});
	});

	it('preserves a newer operation lock when an old timeout is redelivered', async () => {
		const db = getFirestore();
		await db
			.doc('ownerOperations/old-reset')
			.set({
				operation: 'yearly-reset',
				status: 'failed',
				stage: 'backup-timeout',
			});
		const lock = db.doc('ownerOperationLocks/yearly-reset');
		await lock.set({ operationId: 'new-reset' });
		await ownerOperationWorker({ data: { operationId: 'old-reset' } });
		expect((await lock.get()).data()).toEqual({ operationId: 'new-reset' });
	});
});
