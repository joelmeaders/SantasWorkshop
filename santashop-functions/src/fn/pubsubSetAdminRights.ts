import admin from '../firebase-admin';
import {
	ADMIN_BOOTSTRAP_PASSWORD,
	ADMIN_UIDS,
} from '../utility/runtime-config';

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
		await admin.auth().setCustomUserClaims(uid, { admin: true });
	}
}
