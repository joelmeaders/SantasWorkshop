import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { createRegistrationReviewDenylist } from './registration-review-denylist';

export function assertRegistrationReviewEmulatorIsolation(): void {
	if (process.env['FUNCTIONS_EMULATOR'] === 'true') {
		const project =
			process.env['GCLOUD_PROJECT'] ?? process.env['GCP_PROJECT'];
		const isLoopback = (name: string): boolean =>
			/^(?:127\.0\.0\.1|localhost|\[?::1\]?):\d+$/u.test(
				process.env[name] ?? '',
			);
		const demo = ['demo-registration-review', 'demo-santashop'].includes(
			project ?? '',
		);
		// The integration command selects the TEST name but redirects every
		// SDK service to loopback. Never permit a partial emulator for it.
		const isolatedTest =
			project === 'santas-workshop-test' &&
			isLoopback('FIREBASE_AUTH_EMULATOR_HOST') &&
			isLoopback('FIREBASE_STORAGE_EMULATOR_HOST');
		if (
			(!demo && !isolatedTest) ||
			!isLoopback('FIRESTORE_EMULATOR_HOST')
		) {
			throw new HttpsError(
				'unavailable',
				'Registration access cannot be verified.',
			);
		}
	}
}

export function getRegistrationReviewDenylist(db: Firestore) {
	assertRegistrationReviewEmulatorIsolation();
	return createRegistrationReviewDenylist(db);
}

export async function assertRegistrationReviewAllowed(
	db: Firestore,
	identity: { uid?: string; email?: string; additionalEmail?: string },
	transaction?: Transaction,
): Promise<void> {
	const denylist = getRegistrationReviewDenylist(db);
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
