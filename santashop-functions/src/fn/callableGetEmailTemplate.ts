import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type {
	EmailTemplateDetail,
	GetEmailTemplateRequest,
} from '@santashop/models';
import {
	getEmailTemplateSummary,
	listEmailTemplateRevisions,
	readEmailTemplateHtml,
	normalizeEmailTemplateKey,
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

export default async function callableGetEmailTemplate(
	request: CallableRequest<GetEmailTemplateRequest>,
): Promise<EmailTemplateDetail> {
	assertAdmin(request);

	const key = withCallableValidation(() => {
		const data = requireCallableData(request.data);
		return normalizeEmailTemplateKey(
			requireTrimmedString(data['key'], 'Template key'),
		);
	});
	const template = await getEmailTemplateSummary(key);
	if (!template) {
		throw new HttpsError('not-found', `Template ${key} was not found.`);
	}

	const revisions = await listEmailTemplateRevisions(key);
	const currentRevision = revisions.find(
		(revision) => revision.id === template.currentRevisionId,
	);
	const currentHtml = currentRevision
		? await readEmailTemplateHtml(currentRevision.htmlStoragePath)
		: undefined;

	return {
		template,
		revisions,
		currentHtml,
	};
}
