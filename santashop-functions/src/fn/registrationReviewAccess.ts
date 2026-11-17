import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { requireRegistrationReviewAccess } from '../utility/capabilities';

export function registrationReviewEnabled(): boolean {
	if (process.env['SANTASHOP_REGISTRATION_REVIEW_ENABLED'] !== 'true')
		return false;
	return (
		process.env['FUNCTIONS_EMULATOR'] !== 'true' ||
		process.env['GCLOUD_PROJECT'] === 'demo-registration-review' ||
		process.env['GCLOUD_PROJECT'] === 'demo-santashop'
	);
}

export function requireEnabledRegistrationReviewAccess(
	request: CallableRequest<unknown>,
): string {
	const uid = requireRegistrationReviewAccess(request);
	if (!registrationReviewEnabled()) {
		throw new HttpsError(
			'failed-precondition',
			'Registration review is not enabled.',
		);
	}
	return uid;
}
