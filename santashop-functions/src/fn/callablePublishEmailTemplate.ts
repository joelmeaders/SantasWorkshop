import {
	CreateTemplateCommand,
	SESClient,
	SESClientConfig,
	UpdateTemplateCommand,
} from '@aws-sdk/client-ses';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type {
	EmailTemplateRevision,
	EmailTemplateSummary,
	PublishEmailTemplateRequest,
	PublishEmailTemplateResponse,
} from '@santashop/models';
import admin from '../firebase-admin';
import {
	getEmailTemplateDocPath,
	getEmailTemplateRevision,
	getEmailTemplateRevisionDocPath,
	getEmailTemplateSummary,
	normalizeEmailTemplateDeliveryProfile,
	normalizeEmailLanguage,
	normalizeEmailTemplateKey,
	prepareEmailTemplateHtmlForSes,
	readEmailTemplateHtml,
	validateEmailTemplateFieldMappings,
} from '../utility/email-templates';
import { SES_REGION } from '../utility/runtime-config';
import {
	requireCallableData,
	requireOptionalTrimmedString,
	requireTrimmedString,
	withCallableValidation,
} from '../utility/callable-validation';
import { isAdminToken } from '../utility/capabilities';

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

let sesClient: SESClient | undefined;

const assertAdmin = (request: CallableRequest<unknown>): void => {
	if (!isAdminToken(request.auth?.token)) {
		throw new HttpsError(
			'permission-denied',
			'Only admins can publish email templates.',
		);
	}
};

const getSesClient = (): SESClient => {
	sesClient ??= new SESClient({
		credentials,
		region: SES_REGION,
	} as SESClientConfig);

	return sesClient;
};

const upsertSesTemplate = async (
	template: EmailTemplateSummary,
	revision: EmailTemplateRevision,
	html: string,
): Promise<void> => {
	const templateInput = {
		Template: {
			TemplateName: template.awsTemplateName,
			SubjectPart: revision.subjectPart,
			HtmlPart: html,
			TextPart: revision.textPart ?? '',
		},
	};

	try {
		await getSesClient().send(new UpdateTemplateCommand(templateInput));
	} catch (error) {
		const isMissingTemplate =
			error instanceof Error &&
			error.name === 'TemplateDoesNotExistException';
		if (!isMissingTemplate) {
			throw error;
		}

		await getSesClient().send(new CreateTemplateCommand(templateInput));
	}
};

export default async function callablePublishEmailTemplate(
	request: CallableRequest<PublishEmailTemplateRequest>,
): Promise<PublishEmailTemplateResponse> {
	assertAdmin(request);

	const { key, requestedRevisionId } = withCallableValidation(() => {
		const data = requireCallableData(request.data);
		return {
			key: normalizeEmailTemplateKey(
				requireTrimmedString(data['key'], 'Template key'),
			),
			requestedRevisionId: requireOptionalTrimmedString(
				data['revisionId'],
				'Revision ID',
			),
		};
	});
	const template = await getEmailTemplateSummary(key);
	if (!template) {
		throw new HttpsError('not-found', `Template ${key} was not found.`);
	}

	const revisionId = requestedRevisionId ?? template.currentRevisionId;
	if (!revisionId) {
		throw new HttpsError(
			'failed-precondition',
			`Template ${key} does not have a saved revision to publish.`,
		);
	}

	const revision = await getEmailTemplateRevision(key, revisionId);
	if (!revision) {
		throw new HttpsError(
			'not-found',
			`Revision ${revisionId} was not found for ${key}.`,
		);
	}

	withCallableValidation(() =>
		normalizeEmailTemplateDeliveryProfile(revision.deliveryProfile),
	);
	if (
		normalizeEmailLanguage(revision.language) !==
			normalizeEmailLanguage(template.language) ||
		revision.deliveryProfile !== template.deliveryProfile
	) {
		throw new HttpsError(
			'failed-precondition',
			'Revision language and delivery profile must match the template.',
		);
	}
	if (
		(template.seasonalReviewRequired || revision.seasonalReviewRequired) &&
		!revision.seasonalDetailsReviewed
	) {
		throw new HttpsError(
			'failed-precondition',
			'Review and confirm the 2026 venue and opening details before publishing this revision.',
		);
	}
	const html = await readEmailTemplateHtml(revision.htmlStoragePath);
	withCallableValidation(() => {
		validateEmailTemplateFieldMappings(
			normalizeEmailTemplateDeliveryProfile(revision.deliveryProfile),
			revision.subjectPart,
			html + (revision.textPart ?? ''),
			revision.fieldMappings,
		);
	});
	if (
		/CONFIRM 2026 DETAILS BEFORE PUBLISHING|CONFIRMAR LOS DATOS DE 2026 ANTES DE PUBLICAR|TO BE CONFIRMED|POR CONFIRMAR/.test(
			html + (revision.textPart ?? ''),
		)
	)
		throw new HttpsError(
			'failed-precondition',
			'Replace the unconfirmed seasonal draft notes before publishing.',
		);
	const renderedHtml = prepareEmailTemplateHtmlForSes(html);

	try {
		await upsertSesTemplate(template, revision, renderedHtml);
	} catch (error) {
		throw new HttpsError(
			'internal',
			'Failed to publish the SES template.',
			error instanceof Error ? error.message : String(error),
		);
	}

	const publishedOn = new Date();
	const publishedTemplate: EmailTemplateSummary = {
		...template,
		publishedRevisionId: revision.id,
		publishedRevisionNumber: revision.revisionNumber,
		publishedOn,
		updatedOn: publishedOn,
	};
	const publishedRevision: EmailTemplateRevision = {
		...revision,
		publishedOn,
	};

	await Promise.all([
		admin
			.firestore()
			.doc(getEmailTemplateDocPath(key))
			.set(publishedTemplate, { merge: true }),
		admin
			.firestore()
			.doc(getEmailTemplateRevisionDocPath(key, revision.id))
			.set({ publishedOn }, { merge: true }),
	]);

	return {
		template: publishedTemplate,
		revision: publishedRevision,
		renderedHtml,
	};
}
