import admin from '../firebase-admin';
import { isEmailSendingEnabled } from './email-sending';
import {
	GetSendQuotaCommand,
	SendEmailCommand,
	SESClient,
} from '@aws-sdk/client-ses';
import { EMAIL_TEMPLATE_KEYS, type WaitingListEmailPreview } from '../models';
import {
	resolvePublishedEmailTemplate,
	getEmailTemplateRevision,
	readEmailTemplateHtml,
	renderTemplateWithFieldValues,
} from './email-templates';
import {
	EVENT_DISPLAY_NAME,
	PASSWORD_RESET_CONTINUE_URL,
	REGISTRATION_EMAIL_RETURN_PATH,
	REGISTRATION_EMAIL_SOURCE,
	SES_REGION,
} from './runtime-config';

let client: SESClient | undefined;
const ses = (): SESClient =>
	(client ??= new SESClient({
		region: SES_REGION,
		credentials: {
			accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
			secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
		},
		maxAttempts: 1,
	}));

export const waitingListLinks = (): {
	registrationUrl: string;
	waitingListUrl: string;
} => {
	const origin = new URL(PASSWORD_RESET_CONTINUE_URL).origin;
	return {
		registrationUrl: `${origin}/pre-registration/overview`,
		waitingListUrl: `${origin}/?mode=sign-in&waitingList=manage`,
	};
};

export const loadWaitingListEmails = async (): Promise<
	WaitingListEmailPreview[]
> =>
	Promise.all(
		(['en', 'es'] as const).map(async (language) => {
			const published = await resolvePublishedEmailTemplate({
				templateKey: EMAIL_TEMPLATE_KEYS.waitingListCapacity,
				language,
			});
			if (published.language !== language)
				throw new Error(
					'Publish both waiting-list email languages before sending.',
				);
			const key = published.templateSummary.key;
			const revisionId = published.templateSummary.publishedRevisionId;
			if (!revisionId)
				throw new Error('A published waiting-list revision is required.');
			const revision = await getEmailTemplateRevision(key, revisionId);
			if (
				!revision ||
				revision.deliveryProfile !== EMAIL_TEMPLATE_KEYS.waitingListCapacity
			)
				throw new Error('The waiting-list revision is unavailable.');
			const html = await readEmailTemplateHtml(revision.htmlStoragePath);
			const runtime = {
				firstName: '{{firstName}}',
				eventName: EVENT_DISPLAY_NAME,
				...waitingListLinks(),
			};
			const fields = revision.fieldMappings.map((field) => {
				const value = runtime[field.mapping as keyof typeof runtime];
				if (typeof value !== 'string')
					throw new Error('Waiting-list template mapping is unavailable.');
				return { ...field, sampleValue: value };
			});
			return {
				language,
				templateKey: key,
				revisionId,
				subject: renderTemplateWithFieldValues(revision.subjectPart, fields),
				html: renderTemplateWithFieldValues(html, fields),
				text: renderTemplateWithFieldValues(revision.textPart ?? '', fields),
			};
		}),
	);

export const waitingListSendRate = async (): Promise<number> => {
	const quota = await ses().send(new GetSendQuotaCommand({}));
	if (
		!Number.isFinite(quota.MaxSendRate) ||
		(quota.MaxSendRate ?? 0) <= 0 ||
		(quota.Max24HourSend ?? 0) <= (quota.SentLast24Hours ?? 0)
	)
		throw new Error('SES sending quota is unavailable or exhausted.');
	// Leave provider capacity for confirmation and reminder messages.
	return Math.min(5, quota.MaxSendRate! / 2);
};

const escapeHtml = (value: string): string =>
	value.replace(
		/[&<>"']/g,
		(character) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
				character
			] ?? character,
	);
export const sendWaitingListEmail = async (
	email: string,
	firstName: string,
	template: WaitingListEmailPreview,
): Promise<string> => {
	const replace = (value: string, html = false): string =>
		value.replace(/{{\s*firstName\s*}}/g, () =>
			html ? escapeHtml(firstName) : firstName,
		);
	const response = await ses().send(
		new SendEmailCommand({
			Source: REGISTRATION_EMAIL_SOURCE,
			ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
			Destination: { ToAddresses: [email] },
			Message: {
				Subject: { Charset: 'UTF-8', Data: replace(template.subject) },
				Body: {
					Html: { Charset: 'UTF-8', Data: replace(template.html, true) },
					Text: { Charset: 'UTF-8', Data: replace(template.text) },
				},
			},
		}),
	);
	if (!response.MessageId) throw new Error('SES acceptance was not confirmed.');
	return response.MessageId;
};

/** Emulator campaign tests simulate the provider and never call SES. */
export const waitingListSendingAllowed = async (): Promise<boolean> => {
	if (process.env['FUNCTIONS_EMULATOR'] === 'true') {
		const fixture = await admin
			.firestore()
			.doc('_testConfig/emailSending')
			.get();
		return (
			fixture.data()?.['enabled'] === true &&
			fixture.data()?.['simulateWaitingList'] === true
		);
	}
	return isEmailSendingEnabled();
};
