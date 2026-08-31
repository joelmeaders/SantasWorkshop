import { vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

export type TriggerScheduledAdminMock = ReturnType<
	typeof createBackgroundAdminMock
>;

export const sesSendMock = vi.fn();

export const loadTriggerScheduledHandlers = async (
	backgroundMock: TriggerScheduledAdminMock,
) => {
	vi.resetModules();
	sesSendMock.mockReset();
	vi.doMock('firebase-admin', () => backgroundMock.module);
	vi.doMock('@aws-sdk/client-ses', () => ({
		SESClient: class {
			public send = sesSendMock;
		},
		SendTemplatedEmailCommand: class {
			constructor(public readonly input: unknown) {}
		},
	}));

	const [
		sendNewRegistrationEmailsModule,
		scheduledFirestoreBackupModule,
		scheduledDateTimeSlotCountersModule,
		scheduledRegistrationStatsModule,
		scheduledUserStatsModule,
		scheduledCheckInStatsModule,
	] = await Promise.all([
		import('../../../src/fn/sendNewRegistrationEmails2'),
		import('../../../src/fn/scheduledFirestoreBackup'),
		import('../../../src/fn/scheduledDateTimeSlotCounters2'),
		import('../../../src/fn/scheduledRegistrationStats'),
		import('../../../src/fn/scheduledUserStats'),
		import('../../../src/fn/scheduledCheckInStats'),
	]);

	return {
		sendNewRegistrationEmails: sendNewRegistrationEmailsModule.default,
		scheduledFirestoreBackup: scheduledFirestoreBackupModule.default,
		scheduledDateTimeSlotCounters:
			scheduledDateTimeSlotCountersModule.default,
		scheduledRegistrationStats: scheduledRegistrationStatsModule.default,
		scheduledUserStats: scheduledUserStatsModule.default,
		scheduledCheckInStats: scheduledCheckInStatsModule.default,
	};
};
