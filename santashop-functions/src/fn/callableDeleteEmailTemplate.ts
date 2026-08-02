import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { DeleteEmailTemplateRequest } from '@santashop/models';
import admin from '../firebase-admin';
import {
	deleteEmailTemplateHtml,
	getEmailTemplateDocPath,
	getEmailTemplateRevisionCollectionPath,
	normalizeEmailTemplateKey,
} from '../utility/email-templates';
import { isAdminToken } from '../utility/capabilities';

export default async function callableDeleteEmailTemplate(
	request: CallableRequest<DeleteEmailTemplateRequest>,
): Promise<void> {
	if (!isAdminToken(request.auth?.token)) {
		throw new HttpsError(
			'permission-denied',
			'Only admins can manage email templates.',
		);
	}

	const keyValue = request.data?.key;
	if (typeof keyValue !== 'string' || !keyValue.trim()) {
		throw new HttpsError('invalid-argument', 'Template key is required.');
	}

	let key: string;
	try {
		key = normalizeEmailTemplateKey(keyValue);
	} catch (error) {
		throw new HttpsError(
			'invalid-argument',
			error instanceof Error ? error.message : 'Invalid template key.',
		);
	}

	const db = admin.firestore();
	const templateRef = db.doc(getEmailTemplateDocPath(key));
	const templateSnapshot = await templateRef.get();
	if (!templateSnapshot.exists) {
		throw new HttpsError('not-found', 'Email template not found.');
	}

	const revisionsSnapshot = await db
		.collection(getEmailTemplateRevisionCollectionPath(key))
		.get();
	await Promise.all(
		 revisionsSnapshot.docs.map(async (revision) => {
			const data = revision.data() as { htmlStoragePath?: string };
			if (data.htmlStoragePath) {
				await deleteEmailTemplateHtml(data.htmlStoragePath).catch(() => undefined);
			}
		}),
	);

	const batch = db.batch();
	for (const revision of revisionsSnapshot.docs) {
		batch.delete(revision.ref);
	}
	batch.delete(templateRef);
	await batch.commit();
}
