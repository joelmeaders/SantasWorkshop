import admin from '../firebase-admin';
import { COLLECTION_SCHEMA } from '../models';

const AUTH_PAGE_SIZE = 250;

export async function* customerAuthUserBatches(): AsyncGenerator<string[]> {
	let pageToken: string | undefined;
	do {
		const page = await admin.auth().listUsers(AUTH_PAGE_SIZE, pageToken);
		pageToken = page.pageToken;
		const candidates = page.users.filter((user) => {
			const claims = user.customClaims ?? {};
			const roles = claims['roles'];
			return (
				claims['owner'] !== true &&
				!(Array.isArray(roles) && roles.length > 0)
			);
		});
		if (candidates.length === 0) continue;
		const db = admin.firestore();
		const staff = await db.getAll(
			...candidates.map((user) =>
				db.collection(COLLECTION_SCHEMA.staff).doc(user.uid),
			),
			{ fieldMask: [] },
		);
		const customerUids = candidates
			.filter((_user, index) => !staff[index].exists)
			.map((user) => user.uid);
		if (customerUids.length > 0) yield customerUids;
	} while (pageToken);
}
