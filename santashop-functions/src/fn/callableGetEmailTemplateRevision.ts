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
import {
	requireCallableData,
	requireTrimmedString,
	withCallableValidation,
} from '../utility/callable-validation';
import { isAdminToken } from '../utility/capabilities';

const assertAdmin = (request: CallableRequest<unknown>): void => {
	if (!isAdminToken(request.auth?.token)) {
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

	const { key, revisionId } = withCallableValidation(() => {
		const data = requireCallableData(request.data);
		return {
			key: normalizeEmailTemplateKey(
				requireTrimmedString(data['key'], 'Template key'),
			),
			revisionId: requireTrimmedString(data['revisionId'], 'Revision ID'),
		};
	});
	const template = await getEmailTemplateSummary(key);
	if (!template) {
		throw new HttpsError('not-found', `Template ${key} was not found.`);
	}

	const revision = await getEmailTemplateRevision(key, revisionId);
	if (!revision) {
		throw new HttpsError(
			'not-found',
			`Revision ${revisionId} was not found for ${key}.`,
		);
	}

	const html = await readEmailTemplateHtml(revision.htmlStoragePath);
	return { template, revision, html };
}
