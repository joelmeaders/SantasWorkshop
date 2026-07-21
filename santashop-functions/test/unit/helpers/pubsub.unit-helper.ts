import { vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

export type PubsubAdminMock = ReturnType<typeof createBackgroundAdminMock>;

export const parseAsyncMock = vi.fn();
export const writeFileMock = vi.fn();
export const generateUuidMock = vi.fn();

export const loadPubsubHandlers = async (backgroundMock: PubsubAdminMock) => {
	vi.resetModules();
	vi.doMock('firebase-admin', () => backgroundMock.module);
	vi.doMock('json2csv', () => ({ parseAsync: parseAsyncMock }));
	const fsMock = {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ''),
		writeFile: writeFileMock,
	};
	vi.doMock('fs', () => fsMock);
	vi.doMock('node:fs', () => fsMock);
	vi.doMock('uuid', () => ({ v4: generateUuidMock }));

	const [
		pubsubResetCheckInStatsModule,
		pubsubQueueReminderEmailsModule,
		pubsubSetAdminRightsModule,
		pubsubMarkRegistrationsCheckedInModule,
		pubsubExportMarketingEmailsModule,
		pubsubExportRegisteredEmailsModule,
		pubsubAddDateTimeSlotsModule,
		pubsubDeleteUsersModule,
	] = await Promise.all([
		import('../../../src/fn/pubsubResetCheckInStats'),
		import('../../../src/fn/pubsubQueueReminderEmails'),
		import('../../../src/fn/pubsubSetAdminRights'),
		import('../../../src/fn/pubsubMarkRegistrationsCheckedIn'),
		import('../../../src/fn/pubsubExportMarketingEmails'),
		import('../../../src/fn/pubsubExportRegisteredEmails'),
		import('../../../src/fn/pubsubAddDateTimeSlots'),
		import('../../../src/fn/pubsubDeleteUsers'),
	]);

	return {
		pubsubResetCheckInStats: pubsubResetCheckInStatsModule.default,
		pubsubQueueReminderEmails: pubsubQueueReminderEmailsModule.default,
		pubsubSetAdminRights: pubsubSetAdminRightsModule.default,
		pubsubMarkRegistrationsCheckedIn:
			pubsubMarkRegistrationsCheckedInModule.default,
		pubsubExportMarketingEmails: pubsubExportMarketingEmailsModule.default,
		pubsubExportRegisteredEmails:
			pubsubExportRegisteredEmailsModule.default,
		pubsubAddDateTimeSlots: pubsubAddDateTimeSlotsModule.default,
		pubsubDeleteUsers: pubsubDeleteUsersModule.default,
	};
};
