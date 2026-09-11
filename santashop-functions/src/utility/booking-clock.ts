import type { Firestore } from 'firebase-admin/firestore';

/** The override exists only inside a Functions emulator connected to local Firestore. */
export const isBookingClockEmulator = (): boolean =>
	process.env['FUNCTIONS_EMULATOR'] === 'true' &&
	/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/u.test(
		process.env['FIRESTORE_EMULATOR_HOST'] ?? '',
	);

export const getBookingNow = async (db: Firestore): Promise<Date> => {
	if (isBookingClockEmulator()) {
		const snapshot = await db.doc('_testConfig/bookingClock').get();
		const override: unknown = snapshot.data()?.['now'];
		if (typeof override === 'string') {
			const date = new Date(override);
			if (!Number.isFinite(date.valueOf()))
				throw new Error('Invalid emulator booking clock.');
			return date;
		}
	}
	return new Date(Date.now());
};
