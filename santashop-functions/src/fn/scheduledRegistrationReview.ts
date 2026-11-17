import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { Change, FirestoreEvent } from 'firebase-functions/v2/firestore';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import {
	recordRegistrationReviewDelta,
	runRegistrationReviewNightly,
} from '../utility/registration-review-nightly';
import { PROGRAM_YEAR } from '../utility/runtime-config';
import { registrationReviewEnabled } from './registrationReviewAccess';

const log = createFunctionLogger('scheduledRegistrationReview');

function nightlyReviewEnabled(): boolean {
	return (
		registrationReviewEnabled() &&
		process.env['SANTASHOP_REGISTRATION_REVIEW_NIGHTLY_ENABLED'] === 'true'
	);
}

export async function captureRegistrationReviewChange(
	event: FirestoreEvent<
		Change<DocumentSnapshot> | undefined,
		{ registrationId: string }
	>,
): Promise<void> {
	if (!nightlyReviewEnabled() || !event.data) return;
	await recordRegistrationReviewDelta(admin.firestore(), PROGRAM_YEAR, {
		id: event.id,
		before: event.data.before,
		after: event.data.after,
	});
}

export async function runScheduledRegistrationReview(): Promise<void> {
	if (!nightlyReviewEnabled()) return;

	const key = Buffer.from(
		process.env['SANTASHOP_REGISTRATION_REVIEW_HMAC_KEY'] ?? '',
		'base64',
	);
	const result = await runRegistrationReviewNightly(
		admin.firestore(),
		PROGRAM_YEAR,
		key,
		new Date(),
	);
	log.info('Processed registration-review delta.', result);
}
