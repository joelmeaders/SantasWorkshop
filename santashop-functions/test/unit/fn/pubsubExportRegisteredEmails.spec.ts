import { beforeEach, describe, expect, it } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';
import {
	generateUuidMock,
	loadPubsubHandlers,
	parseAsyncMock,
	type PubsubAdminMock,
	writeFileMock,
} from '../helpers/pubsub.unit-helper';

describe('pubsubExportRegisteredEmails handler', () => {
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

	it('exports registered emails to storage', async () => {
		const { pubsubExportRegisteredEmails } =
			await loadPubsubHandlers(backgroundMock);
		backgroundMock.setCollectionDocs('registrations', [
			{
				id: 'reg-1',
				data: {
					emailAddress: 'buddy.elf@example.com',
					firstName: 'Buddy',
					lastName: 'Elf',
					zipCode: '80205',
					registrationSubmittedOn: 'yes',
				},
			},
		]);
		parseAsyncMock.mockResolvedValue('csv-output');

		const result = await pubsubExportRegisteredEmails();

		expect(result).toBe('Upload successful');
		expect(backgroundMock.upload).toHaveBeenCalledTimes(1);
	});
});
