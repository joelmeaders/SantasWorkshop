import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { createRegistrationReviewDenylist } from './registration-review-denylist';

export function getRegistrationReviewDenylist(
	db: Firestore,
): ReturnType<typeof createRegistrationReviewDenylist> | null {
	if (
		process.env['SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED'] !== 'true'
	)
		return null;
	if (process.env['FUNCTIONS_EMULATOR'] === 'true') {
		const project =
			process.env['GCLOUD_PROJECT'] ?? process.env['GCP_PROJECT'];
		if (
			!['demo-registration-review', 'demo-santashop'].includes(
				project ?? '',
			) ||
			!/^(?:127\.0\.0\.1|localhost):\d+$/u.test(
				process.env['FIRESTORE_EMULATOR_HOST'] ?? '',
			)
		) {
			throw new HttpsError(
				'unavailable',
				'Registration access cannot be verified.',
			);
		}
	}
	const secret =
		process.env['SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY'] ?? '';
	if (!/^[A-Za-z0-9+/]{43}=$/u.test(secret)) {
		throw new HttpsError(
			'unavailable',
			'Registration access cannot be verified.',
		);
	}
	return createRegistrationReviewDenylist(db, Buffer.from(secret, 'base64'));
}

export async function assertRegistrationReviewAllowed(
	db: Firestore,
	identity: { uid?: string; email?: string; additionalEmail?: string },
	transaction?: Transaction,
): Promise<void> {
	const denylist = getRegistrationReviewDenylist(db);
	if (!denylist) return;
	const emails = new Set(
		[identity.email, identity.additionalEmail]
			.map((email) =>
				typeof email === 'string'
					? email.trim().toLowerCase()
					: undefined,
			)
			.filter((email): email is string => Boolean(email)),
	);
	const checks = [
		...(identity.uid
			? [denylist.isUidBlocked(identity.uid, transaction)]
			: []),
		...[...emails].map((email) =>
			denylist.isEmailBlocked(email, transaction),
		),
	];
	if ((await Promise.all(checks)).includes(true)) {
		throw new HttpsError(
			'permission-denied',
			'This registration action is not available.',
		);
	}
}
