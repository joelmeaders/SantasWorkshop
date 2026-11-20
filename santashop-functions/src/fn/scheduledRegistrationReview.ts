import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { Change, FirestoreEvent } from 'firebase-functions/v2/firestore';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { assertRegistrationReviewEmulatorIsolation } from '../utility/registration-review-denylist-access';
import {
	buildNightlyRegistrationReview,
	recordRegistrationReviewDelta,
} from '../utility/registration-review-nightly';
import { PROGRAM_YEAR } from '../utility/runtime-config';

const log = createFunctionLogger('scheduledRegistrationReview');

export async function captureRegistrationReviewChange(
	event: FirestoreEvent<
		Change<DocumentSnapshot> | undefined,
		{ registrationId: string }
	>,
): Promise<void> {
	if (!event.data) return;
	assertRegistrationReviewEmulatorIsolation();
	await recordRegistrationReviewDelta(admin.firestore(), PROGRAM_YEAR, {
		id: event.id,
		before: event.data.before,
		after: event.data.after,
	});
}

export async function runScheduledRegistrationReview(): Promise<void> {
	assertRegistrationReviewEmulatorIsolation();
	const result = await buildNightlyRegistrationReview(
		admin.firestore(),
		PROGRAM_YEAR,
		new Date(),
	);
	log.info('Processed registration-review delta.', result);
}
