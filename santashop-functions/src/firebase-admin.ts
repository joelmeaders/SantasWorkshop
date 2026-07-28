import * as firebaseAdmin from 'firebase-admin';
import type { AppOptions } from 'firebase-admin/app';

interface FirebaseEnvironmentConfig {
	projectId?: string;
	storageBucket?: string;
}

const parseFirebaseConfig = (): FirebaseEnvironmentConfig => {
	const rawConfig = process.env['FIREBASE_CONFIG'];
	if (!rawConfig) {
		return {};
	}

	try {
		return JSON.parse(rawConfig) as FirebaseEnvironmentConfig;
	} catch {
		return {};
	}
};

const buildAppOptions = (): AppOptions => {
	const firebaseConfig = parseFirebaseConfig();

	return {
		projectId:
			firebaseConfig.projectId ??
			process.env['GCLOUD_PROJECT'] ??
			process.env['GCP_PROJECT'],
		storageBucket:
			firebaseConfig.storageBucket ??
			process.env['FIREBASE_STORAGE_BUCKET'],
	};
};

if (firebaseAdmin.apps.length === 0) {
	firebaseAdmin.initializeApp(buildAppOptions());
}

export default firebaseAdmin;
