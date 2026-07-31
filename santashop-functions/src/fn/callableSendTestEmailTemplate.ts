import {
	SendEmailCommand,
	SESClient,
	SESClientConfig,
} from '@aws-sdk/client-ses';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type {
	SendTestEmailTemplateRequest,
	SendTestEmailTemplateResponse,
} from '@santashop/models';
import {
	extractHandlebarsFieldNames,
	normalizeEmailTemplateDeliveryProfile,
	normalizeEmailTemplateFieldDefinitions,
	prepareEmailTemplateHtmlForSes,
	renderTemplateWithFieldValues,
	hasImplicitQrCodePlaceholder,
} from '../utility/email-templates';
import {
	REGISTRATION_EMAIL_RETURN_PATH,
	REGISTRATION_EMAIL_SOURCE,
	SES_REGION,
} from '../utility/runtime-config';
import {
	requireArray,
	requireCallableData,
	requireEmailAddress,
	requireTrimmedString,
	withCallableValidation,
} from '../utility/callable-validation';

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

let sesClient: SESClient | undefined;

const assertAdmin = (request: CallableRequest<unknown>): void => {
	if (request.auth?.token?.['admin'] !== true) {
		throw new HttpsError(
			'permission-denied',
			'Only admins can send test email templates.',
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

const validateDetectedFields = (
	subjectPart: string,
	html: string,
	fieldMappings: ReturnType<typeof normalizeEmailTemplateFieldDefinitions>,
): void => {
	const detected = new Set(extractHandlebarsFieldNames(subjectPart, html));
	if (hasImplicitQrCodePlaceholder(html)) {
		detected.add('qrCodeUrl');
	}

	const configured = new Set(fieldMappings.map((field) => field.name));
	for (const fieldName of detected) {
		if (!configured.has(fieldName)) {
			throw new HttpsError(
				'invalid-argument',
				`Missing test data for template field ${fieldName}.`,
			);
		}
	}
};

export default async function callableSendTestEmailTemplate(
	request: CallableRequest<SendTestEmailTemplateRequest>,
): Promise<SendTestEmailTemplateResponse> {
	assertAdmin(request);
	const { recipientEmail, subjectPart, html, fieldMappings } =
		withCallableValidation(() => {
			const data = requireCallableData(request.data);
			normalizeEmailTemplateDeliveryProfile(
				requireTrimmedString(
					data['deliveryProfile'],
					'Delivery profile',
				),
			);

			return {
				recipientEmail: requireEmailAddress(
					data['recipientEmail'],
					'Recipient email',
				),
				subjectPart: requireTrimmedString(
					data['subjectPart'],
					'Subject',
				),
				html: requireTrimmedString(data['html'], 'HTML'),
				fieldMappings: normalizeEmailTemplateFieldDefinitions(
					requireArray(data['fieldMappings'], 'Field mappings'),
				),
			};
		});
	validateDetectedFields(subjectPart, html, fieldMappings);

	const renderedSubject = renderTemplateWithFieldValues(
		subjectPart,
		fieldMappings,
	);
	const renderedHtml = renderTemplateWithFieldValues(
		prepareEmailTemplateHtmlForSes(html),
		fieldMappings,
	);

	const sendCommand = new SendEmailCommand({
		Destination: {
			ToAddresses: [recipientEmail],
		},
		Message: {
			Subject: {
				Charset: 'UTF-8',
				Data: renderedSubject,
			},
			Body: {
				Html: {
					Charset: 'UTF-8',
					Data: renderedHtml,
				},
			},
		},
		Source: REGISTRATION_EMAIL_SOURCE,
		ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
	});

	try {
		await getSesClient().send(sendCommand);
	} catch (error) {
		throw new HttpsError(
			'internal',
			'Failed to send the test email.',
			error instanceof Error ? error.message : String(error),
		);
	}

	return {
		recipientEmail,
		renderedSubject,
		renderedHtml,
	};
}
