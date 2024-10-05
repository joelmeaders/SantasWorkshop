/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

admin.initializeApp();

export default async (): Promise<void> => {
	let count = 0;

	const listUsers = (nextPageToken?: string) =>
		admin.auth().listUsers(1000, nextPageToken);

	const deleteAllUsers = async (
		nextPageToken?: string,
		abortCount?: number,
	) => {
		if (abortCount && abortCount > 10) {
			throw new Error('ABORTING: COUNT EXCEEDED');
		}

		const userResult = await listUsers(nextPageToken);
		const uids = userResult.users
			.filter((e) => !e.disabled)
			.map((e) => e.uid);

		await admin.auth().deleteUsers(uids);

		if (userResult.pageToken && count <= 10) {
			count++;
			await sleep(3000);
			await deleteAllUsers(userResult.pageToken, count);
		}
	};

	return deleteAllUsers()
		.then(() => {
			console.log('Deleted all users');
		})
		.catch((error) => {
			console.error('Error deleting all users', error);
			throw new functions.https.HttpsError(
				'internal',
				'Unable to delete all users',
				JSON.stringify(error),
			);
		});
};

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
