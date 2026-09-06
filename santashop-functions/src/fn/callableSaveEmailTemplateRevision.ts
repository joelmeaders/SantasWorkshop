import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type {
	EmailTemplateDeliveryProfile,
	EmailTemplateRevision,
	EmailTemplateSummary,
	SaveEmailTemplateRevisionRequest,
	SaveEmailTemplateRevisionResponse,
} from '@santashop/models';
import admin from '../firebase-admin';
import {
	deleteEmailTemplateHtml,
	getEmailTemplateDocPath,
	getEmailTemplateRevisionCollectionPath,
	getEmailTemplateRevisionStoragePath,
	normalizeAwsTemplateName,
	normalizeEmailLanguage,
	normalizeEmailTemplateDeliveryProfile,
	normalizeEmailTemplateFieldDefinitions,
	normalizeEmailTemplateKey,
	validateEmailTemplateFieldMappings,
	writeEmailTemplateHtml,
} from '../utility/email-templates';
import {
	requireArray,
	requireCallableData,
	requireOptionalTrimmedString,
	requireTrimmedString,
	withCallableValidation,
} from '../utility/callable-validation';
import { isAdminToken } from '../utility/capabilities';

const assertAdmin = (
	request: CallableRequest<unknown>,
): { email?: string; uid: string } => {
	if (!isAdminToken(request.auth?.token) || !request.auth?.uid) {
		throw new HttpsError(
			'permission-denied',
			'Only admins can manage email templates.',
		);
	}

	return {
		uid: request.auth.uid,
		email:
			typeof request.auth.token.email === 'string'
				? request.auth.token.email
				: undefined,
	};
};

const getLatestRevisionNumber = (
	template: EmailTemplateSummary | undefined,
): number =>
	Math.max(
		template?.currentRevisionNumber ?? 0,
		template?.publishedRevisionNumber ?? 0,
	);

export default async function callableSaveEmailTemplateRevision(
	request: CallableRequest<SaveEmailTemplateRevisionRequest>,
): Promise<SaveEmailTemplateRevisionResponse> {
	const actor = assertAdmin(request);
	const {
		key,
		language,
		textPart,
		seasonalReviewRequired,
		seasonalDetailsReviewed,
		deliveryProfile,
		displayName,
		subjectPart,
		html,
		awsTemplateName,
		description,
		notes,
		fieldMappings,
	} = withCallableValidation(() => {
		const data = requireCallableData(request.data);
		const normalizedDeliveryProfile: EmailTemplateDeliveryProfile =
			normalizeEmailTemplateDeliveryProfile(
				requireTrimmedString(
					data['deliveryProfile'],
					'Delivery profile',
				),
			);
		const normalizedSubject = requireTrimmedString(
			data['subjectPart'],
			'Subject',
		);
		const normalizedHtml = requireTrimmedString(data['html'], 'HTML');
		const textPart =
			requireOptionalTrimmedString(data['textPart'], 'Plain text') ?? '';
		for (const flag of [
			'seasonalReviewRequired',
			'seasonalDetailsReviewed',
		]) {
			if (data[flag] !== undefined && typeof data[flag] !== 'boolean')
				throw new HttpsError(
					'invalid-argument',
					'Seasonal review fields must be boolean.',
				);
		}
		if (Buffer.byteLength(normalizedHtml + textPart, 'utf8') > 500000)
			throw new HttpsError(
				'invalid-argument',
				'Template content must not exceed 500 KB.',
			);
		const normalizedFieldMappings = normalizeEmailTemplateFieldDefinitions(
			requireArray(data['fieldMappings'], 'Field mappings'),
		);

		validateEmailTemplateFieldMappings(
			normalizedDeliveryProfile,
			normalizedSubject,
			normalizedHtml + textPart,
			normalizedFieldMappings,
		);

		return {
			language: normalizeEmailLanguage(data['language']),
			textPart,
			seasonalReviewRequired: data['seasonalReviewRequired'] === true,
			seasonalDetailsReviewed: data['seasonalDetailsReviewed'] === true,
			key: normalizeEmailTemplateKey(
				requireTrimmedString(data['key'], 'Template key'),
			),
			deliveryProfile: normalizedDeliveryProfile,
			displayName: requireTrimmedString(
				data['displayName'],
				'Display name',
			),
			subjectPart: normalizedSubject,
			html: normalizedHtml,
			awsTemplateName: normalizeAwsTemplateName(
				requireTrimmedString(
					data['awsTemplateName'],
					'AWS template name',
				),
			),
			description: requireOptionalTrimmedString(
				data['description'],
				'Description',
			),
			notes: requireOptionalTrimmedString(data['notes'], 'Notes'),
			fieldMappings: normalizedFieldMappings,
		};
	});

	const templateRef = admin.firestore().doc(getEmailTemplateDocPath(key));
	const revisionsCollection = admin
		.firestore()
		.collection(getEmailTemplateRevisionCollectionPath(key));
	const revisionRef = revisionsCollection.doc();
	const storagePath = getEmailTemplateRevisionStoragePath(
		key,
		revisionRef.id,
	);

	try {
		await writeEmailTemplateHtml(storagePath, html);

		const existingNames = await admin
			.firestore()
			.collection('emailTemplates')
			.where('awsTemplateName', '==', awsTemplateName)
			.get();
		if (existingNames.docs.some((doc) => doc.id !== key))
			throw new HttpsError(
				'already-exists',
				'That SES name belongs to another template.',
			);
		const now = new Date();
		// One SES name belongs to one template, including concurrent draft creation.
		const nameRef = admin
			.firestore()
			.doc('emailTemplateNames/' + awsTemplateName);

		const result = await admin
			.firestore()
			.runTransaction(async (transaction) => {
				const templateSnapshot = await transaction.get(templateRef);
				const nameSnapshot = await transaction.get(nameRef);
				if (
					nameSnapshot.exists &&
					nameSnapshot.data()?.['templateKey'] !== key
				)
					throw new HttpsError(
						'already-exists',
						'That SES name belongs to another template.',
					);
				if (request.data.createOnly === true && templateSnapshot.exists)
					throw new HttpsError(
						'already-exists',
						'Choose a new template key for this imported draft.',
					);
				const existingTemplate = templateSnapshot.exists
					? (templateSnapshot.data() as EmailTemplateSummary)
					: undefined;

				if (
					existingTemplate &&
					(normalizeEmailLanguage(existingTemplate.language) !==
						language ||
						existingTemplate.deliveryProfile !== deliveryProfile)
				) {
					throw new HttpsError(
						'invalid-argument',
						'Existing templates must keep their language and delivery profile.',
					);
				}
				if (
					existingTemplate?.seasonalReviewRequired &&
					!seasonalReviewRequired
				)
					throw new HttpsError(
						'invalid-argument',
						'Seasonal review cannot be removed.',
					);
				if (
					existingTemplate?.awsTemplateName &&
					existingTemplate.awsTemplateName !== awsTemplateName
				) {
					throw new HttpsError(
						'invalid-argument',
						'Existing templates must keep the same AWS SES template name. Create a new template record if you need a different SES name.',
					);
				}
				const revisionNumber =
					getLatestRevisionNumber(existingTemplate) + 1;

				const revision: EmailTemplateRevision = {
					language,
					textPart,
					seasonalReviewRequired,
					seasonalDetailsReviewed,
					id: revisionRef.id,
					templateKey: key,
					deliveryProfile,
					revisionNumber,
					subjectPart,
					htmlStoragePath: storagePath,
					htmlFileName: `${key}-revision-${revisionNumber}.html`,
					fieldMappings,
					...(notes ? { notes } : {}),
					createdOn: now,
					createdByUid: actor.uid,
					...(actor.email ? { createdByEmail: actor.email } : {}),
					publishedOn: false,
				};

				const template: EmailTemplateSummary = {
					language,
					textPart,
					seasonalReviewRequired,
					seasonalDetailsReviewed,
					key,
					deliveryProfile,
					displayName,
					...(description ? { description } : {}),
					subjectPart,
					awsTemplateName,
					fieldMappings,
					currentRevisionId: revision.id,
					currentRevisionNumber: revision.revisionNumber,
					...(existingTemplate?.publishedRevisionId
						? {
								publishedRevisionId:
									existingTemplate.publishedRevisionId,
								publishedRevisionNumber:
									existingTemplate.publishedRevisionNumber,
								publishedOn: existingTemplate.publishedOn,
							}
						: {}),
					createdOn: existingTemplate?.createdOn ?? now,
					updatedOn: now,
				};

				transaction.set(nameRef, { templateKey: key });
				transaction.set(revisionRef, revision);
				transaction.set(templateRef, template);

				return { revision, template };
			});

		return {
			template: result.template,
			revision: result.revision,
			html,
		};
	} catch (error) {
		await deleteEmailTemplateHtml(storagePath).catch(() => undefined);

		if (error instanceof HttpsError) {
			throw error;
		}

		throw new HttpsError(
			'internal',
			'Failed to save the email template revision.',
			error instanceof Error ? error.message : String(error),
		);
	}
}
