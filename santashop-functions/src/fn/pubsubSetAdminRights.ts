import admin from '../firebase-admin';
import {
	ADMIN_BOOTSTRAP_PASSWORD,
	ADMIN_UIDS,
} from '../utility/runtime-config';
import { COLLECTION_SCHEMA, StaffAccount } from '../models';

export default async function pubsubSetAdminRights(): Promise<void> {
	for (const uid of ADMIN_UIDS) {
		if (
			!ADMIN_BOOTSTRAP_PASSWORD ||
			ADMIN_BOOTSTRAP_PASSWORD.includes('replace-with-')
		) {
			throw new Error(
				'ADMIN_BOOTSTRAP_PASSWORD must be set to a non-placeholder value before granting admin rights.',
			);
		}

		await admin.auth().updateUser(uid, {
			disabled: false,
			password: ADMIN_BOOTSTRAP_PASSWORD,
		});

		const user = await admin.auth().getUser(uid);
		const roles = ['admin', 'checkin'] as const;
		await admin.auth().setCustomUserClaims(uid, {
			roles,
			admin: true,
		});

		const staffDocRef = admin
			.firestore()
			.doc(`${COLLECTION_SCHEMA.staff}/${uid}`);
		const existingSnapshot = await staffDocRef.get();
		const existing = existingSnapshot.data() as Partial<StaffAccount> | undefined;
		const now = new Date();

		const staffAccount: StaffAccount = {
			uid,
			displayName: user.displayName ?? user.email ?? `Admin ${uid}`,
			emailAddress:
				user.email?.toLowerCase() ??
				existing?.emailAddress ??
				`${uid}@bootstrap.local`,
			roles: [...roles],
			disabled: false,
			createdOn: existing?.createdOn ?? now,
			updatedOn: now,
		};

		await staffDocRef.set(staffAccount, { merge: true });
	}
}
