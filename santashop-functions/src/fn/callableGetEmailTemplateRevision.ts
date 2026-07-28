import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type {
	GetEmailTemplateRevisionRequest,
	GetEmailTemplateRevisionResponse,
} from '@santashop/models';
import {
	getEmailTemplateRevision,
	getEmailTemplateSummary,
	normalizeEmailTemplateKey,
	readEmailTemplateHtml,
} from '../utility/email-templates';

const assertAdmin = (request: CallableRequest<unknown>): void => {
	if (request.auth?.token?.['admin'] !== true) {
		throw new HttpsError(
			'permission-denied',
			'Only admins can manage email templates.',
		);
	}
};

export default async function callableGetEmailTemplateRevision(
	request: CallableRequest<GetEmailTemplateRevisionRequest>,
): Promise<GetEmailTemplateRevisionResponse> {
	assertAdmin(request);

	const key = normalizeEmailTemplateKey(request.data.key);
	const template = await getEmailTemplateSummary(key);
	if (!template) {
		throw new HttpsError('not-found', `Template ${key} was not found.`);
	}

	const revision = await getEmailTemplateRevision(key, request.data.revisionId);
	if (!revision) {
		throw new HttpsError(
			'not-found',
			`Revision ${request.data.revisionId} was not found for ${key}.`,
		);
	}

	const html = await readEmailTemplateHtml(revision.htmlStoragePath);
	return { template, revision, html };
}
