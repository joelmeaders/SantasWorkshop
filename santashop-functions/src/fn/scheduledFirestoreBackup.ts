import admin from '../firebase-admin';
import { FIRESTORE_BACKUP_BUCKET } from '../utility/runtime-config';

const client = new admin.firestore.v1.FirestoreAdminClient();

export default async function scheduledFirestoreBackup(): Promise<void> {
	const env = process.env as Record<string, string | undefined>;
	const projectId = env['GCP_PROJECT'] ?? env['GCLOUD_PROJECT'] ?? '';
	const databaseName = client.databasePath(projectId, '(default)');
	const bucket = FIRESTORE_BACKUP_BUCKET;

	try {
		const responses = await client.exportDocuments({
			name: databaseName,
			outputUriPrefix: bucket,
			// Leave collectionIds empty to export all collections
			// or set to a list of collection IDs to export,
			// collectionIds: ['users', 'posts']
			collectionIds: [],
		});
		const response = responses[0];
		console.log(`Operation Name: ${response.name}`);
	} catch (error) {
		console.error(`Error: ${projectId}, ${databaseName}: ${error}`);
		throw new Error('Export operation failed');
	}
}
