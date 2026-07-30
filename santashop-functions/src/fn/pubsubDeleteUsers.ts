import { HttpsError } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import { createFunctionLogger } from '../utility/observability';
import { ADMIN_UIDS } from '../utility/runtime-config';

const PROTECTED_UIDS = new Set<string>(ADMIN_UIDS);

const log = createFunctionLogger('pubsubDeleteUsers');

const isElevatedUser = (user: {
	uid: string;
	disabled?: boolean;
	customClaims?: Record<string, unknown>;
}): boolean => {
	const claims = user.customClaims ?? {};
	const roles = claims['roles'];

	return (
		PROTECTED_UIDS.has(user.uid) ||
		claims['admin'] === true ||
		(Array.isArray(roles) && roles.length > 0)
	);
};

export default async function pubsubDeleteUsers(): Promise<void> {
	let count = 0;

	const listUsers = (
		nextPageToken?: string,
	): ReturnType<ReturnType<typeof admin.auth>['listUsers']> =>
		admin.auth().listUsers(1000, nextPageToken);

	const deleteAllUsers = async (
		nextPageToken?: string,
		abortCount?: number,
	): Promise<void> => {
		if (abortCount && abortCount > 10) {
			throw new Error('ABORTING: COUNT EXCEEDED');
		}

		const userResult = await listUsers(nextPageToken);
		const uids = userResult.users
			.filter((e) => !e.disabled)
			.filter((e) => !isElevatedUser(e))
			.map((e) => e.uid);

		if (uids.length > 0) {
			await admin.auth().deleteUsers(uids);
		}

		if (userResult.pageToken && count <= 10) {
			count++;
			await sleep(3000);
			await deleteAllUsers(userResult.pageToken, count);
		}
	};

	return deleteAllUsers()
		.then(() => {
			log.info('Completed bulk user deletion run', {
				pageIterations: count,
			});
		})
		.catch((error) => {
			log.error(
				'Failed during bulk user deletion run',
				{ pageIterations: count },
				error,
			);
			throw new HttpsError(
				'internal',
				'Unable to delete all users',
				JSON.stringify(error),
			);
		});
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
