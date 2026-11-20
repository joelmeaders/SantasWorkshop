import type { CallableRequest } from 'firebase-functions/v2/https';
import { requireRegistrationReviewAccess } from '../utility/capabilities';
import { assertRegistrationReviewEmulatorIsolation } from '../utility/registration-review-denylist-access';

export function requireRegistrationReviewRequestAccess(
	request: CallableRequest<unknown>,
): string {
	const uid = requireRegistrationReviewAccess(request);
	assertRegistrationReviewEmulatorIsolation();
	return uid;
}
