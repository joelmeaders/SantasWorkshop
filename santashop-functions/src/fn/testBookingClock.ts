import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { isBookingClockEmulator } from '../utility/booking-clock';

export const testSetBookingClock = async (
	request: CallableRequest<{ now: string | null }>,
): Promise<{ success: true }> => {
	if (!isBookingClockEmulator())
		throw new HttpsError(
			'permission-denied',
			'This helper requires local emulators.',
		);
	const now = request.data?.now;
	if (
		now !== null &&
		(typeof now !== 'string' || !Number.isFinite(new Date(now).valueOf()))
	) {
		throw new HttpsError(
			'invalid-argument',
			'Supply an ISO timestamp or null.',
		);
	}
	const ref = admin.firestore().doc('_testConfig/bookingClock');
	if (now === null) await ref.delete();
	else await ref.set({ now });
	return { success: true };
};
