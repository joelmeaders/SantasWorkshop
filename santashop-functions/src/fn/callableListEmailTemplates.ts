import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { EmailTemplateSummary } from '@santashop/models';
import { listEmailTemplateSummaries } from '../utility/email-templates';
import { isAdminToken } from '../utility/capabilities';

const assertAdmin = (request: CallableRequest<unknown>): void => {
	if (!isAdminToken(request.auth?.token)) {
		throw new HttpsError(
			'permission-denied',
			'Only admins can manage email templates.',
		);
	}
};

export default async function callableListEmailTemplates(
	request: CallableRequest<unknown>,
): Promise<EmailTemplateSummary[]> {
	assertAdmin(request);
	return listEmailTemplateSummaries();
}
