import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubSetAdminRights handler', () => {
	let backgroundMock: PubsubAdminMock;

	beforeEach(() => {
		backgroundMock = createBackgroundAdminMock();
		backgroundMock.upload.mockResolvedValue(undefined);
		generateUuidMock.mockReturnValue('token-123');
		parseAsyncMock.mockReset();
		writeFileMock.mockImplementation(
			(
				_path: string,
				_output: string,
				callback: (error?: Error | null) => void,
			) => callback(null),
		);
	});

	it('assigns admin claims to the configured users', async () => {
		const { pubsubSetAdminRights } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.updateUser.mockResolvedValue(undefined);
		backgroundMock.getUser.mockResolvedValue({
			email: 'admin@example.com',
			displayName: 'Admin User',
		});
		backgroundMock.setCustomUserClaims.mockResolvedValue(undefined);

		await pubsubSetAdminRights();

		expect(backgroundMock.updateUser).toHaveBeenCalledTimes(5);
		expect(backgroundMock.setCustomUserClaims).toHaveBeenCalledTimes(5);
		expect(backgroundMock.setCustomUserClaims).toHaveBeenCalledWith(
			expect.any(String),
			{
				roles: ['admin', 'checkin'],
				admin: true,
			},
		);
		expect(backgroundMock.getDocRef('staff/bIMHv99EssTqMfhX2kkYm2vErwu1').set)
			.toHaveBeenCalled();
	});

	it('fails fast when the bootstrap password is still the placeholder value', async () => {
		process.env['ADMIN_BOOTSTRAP_PASSWORD'] =
			'replace-with-local-admin-bootstrap-password';
		const { pubsubSetAdminRights } =
			await loadPubsubHandlers(backgroundMock);

		await expect(pubsubSetAdminRights()).rejects.toThrow(
			'ADMIN_BOOTSTRAP_PASSWORD must be set to a non-placeholder value before granting admin rights.',
		);
	});
});
