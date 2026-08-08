import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

describe('callableDeleteEmailTemplate', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
		adminMock.batchCommit.mockResolvedValue(undefined);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
	});

	const loadHandler = async () =>
		(await import('../../../src/fn/callableDeleteEmailTemplate')).default;

	it('deletes template html, every revision, and the template document', async () => {
		const handler = await loadHandler();
		adminMock.setDocSnapshot('emailTemplates/registration-2026', { key: 'registration-2026' });
		const revisionRef = adminMock.getDocRef(
			'emailTemplates/registration-2026/revisions/rev-1',
		);
		adminMock.getCollectionRef('emailTemplates/registration-2026/revisions').get.mockResolvedValue({
			docs: [
				{
					ref: revisionRef,
					data: () => ({
						htmlStoragePath: 'emailTemplates/registration-2026/revisions/rev-1.html',
					}),
				},
			],
		});

		await expect(
			handler({
				data: { key: 'registration-2026' },
				auth: { uid: 'admin-1', token: { admin: true } },
			} as never),
		).resolves.toBeUndefined();

		expect(
			adminMock.getFileRef(
				'emailTemplates/registration-2026/revisions/rev-1.html',
			).delete,
		).toHaveBeenCalledWith();
		expect(adminMock.batchDelete).toHaveBeenCalledWith(revisionRef);
		expect(adminMock.batchDelete).toHaveBeenCalledWith(
			adminMock.getDocRef('emailTemplates/registration-2026'),
		);
		expect(adminMock.batchCommit).toHaveBeenCalledTimes(1);
	});

	it.each([
		[
			'caller is not an admin',
			{ data: { key: 'registration-2026' }, auth: { uid: 'user', token: {} } },
			'permission-denied',
		],
		['key is omitted', { data: {}, auth: { uid: 'admin', token: { admin: true } } }, 'invalid-argument'],
	])('rejects when %s', async (_description, request, code) => {
		const handler = await loadHandler();
		await expect(handler(request as never)).rejects.toMatchObject({ code });
	});
});
