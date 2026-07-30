import type {
	EmailTemplateDeliveryProfile,
	EmailTemplateFieldDefinition,
	EmailTemplateRevision,
	EmailTemplateSummary,
} from '@santashop/models';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_DELIVERY_PROFILES,
	EMAIL_TEMPLATE_KEYS,
	EMAIL_TEMPLATE_RUNTIME_FIELDS,
} from '@santashop/models';
import admin from '../firebase-admin';
import {
	REGISTRATION_EMAIL_TEMPLATE,
	REMINDER_EMAIL_TEMPLATE,
} from './runtime-config';

export interface EmailTemplateReferenceLike {
	template?: string;
	templateKey?: string;
}

export interface EmailTemplateRuntimeData {
	firstName: string;
	eventName: string;
	qrCodeUrl: string;
	code: string;
	dateTime: string;
}

export interface ResolvedPublishedEmailTemplate {
	templateName: string;
	templateSummary?: EmailTemplateSummary;
	usedLegacyFallback: boolean;
}

const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AWS_TEMPLATE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_TEMPLATE_STORAGE_ROOT = 'emailTemplates';
const HANDLEBARS_FIELD_PATTERN = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const FALLBACK_TEMPLATE_NAMES: Readonly<Record<string, string>> = {
	[EMAIL_TEMPLATE_KEYS.registrationConfirmation]: REGISTRATION_EMAIL_TEMPLATE,
	[EMAIL_TEMPLATE_KEYS.eventReminder]: REMINDER_EMAIL_TEMPLATE,
};

const DELIVERY_PROFILE_VALUES = new Set<string>(
	Object.values(EMAIL_TEMPLATE_DELIVERY_PROFILES),
);

export const getEmailTemplateDocPath = (key: string): string =>
	`${COLLECTION_SCHEMA.emailTemplates}/${key}`;

export const getEmailTemplateRevisionCollectionPath = (key: string): string =>
	`${getEmailTemplateDocPath(key)}/revisions`;

export const getEmailTemplateRevisionDocPath = (
	key: string,
	revisionId: string,
): string => `${getEmailTemplateRevisionCollectionPath(key)}/${revisionId}`;

export const getEmailTemplateRevisionStoragePath = (
	key: string,
	revisionId: string,
): string =>
	`${EMAIL_TEMPLATE_STORAGE_ROOT}/${key}/revisions/${revisionId}.html`;

export const normalizeEmailTemplateKey = (value: string): string => {
	const normalized = value.trim().toLowerCase();

	if (!TEMPLATE_KEY_PATTERN.test(normalized)) {
		throw new Error(
			'Template key must use lowercase letters, numbers, and hyphens only.',
		);
	}

	return normalized;
};

export const isEmailTemplateDeliveryProfile = (
	value: string,
): value is EmailTemplateDeliveryProfile => DELIVERY_PROFILE_VALUES.has(value);

export const normalizeEmailTemplateDeliveryProfile = (
	value: string,
): EmailTemplateDeliveryProfile => {
	const normalized = value.trim().toLowerCase();
	if (!isEmailTemplateDeliveryProfile(normalized)) {
		throw new Error(
			`Unsupported email template delivery profile: ${value}`,
		);
	}

	return normalized;
};

export const normalizeAwsTemplateName = (value: string): string => {
	const normalized = value.trim();

	if (!AWS_TEMPLATE_NAME_PATTERN.test(normalized)) {
		throw new Error(
			'AWS template name must be 1-64 characters using letters, numbers, underscores, or hyphens.',
		);
	}

	return normalized;
};

export const normalizeEmailTemplateFieldDefinitions = (
	fields: EmailTemplateFieldDefinition[],
): EmailTemplateFieldDefinition[] => {
	const deduped = new Map<string, EmailTemplateFieldDefinition>();

	for (const field of fields) {
		const name = field.name.trim();
		if (!name) {
			continue;
		}

		deduped.set(name, {
			name,
			mapping: field.mapping.trim(),
			sampleValue: field.sampleValue.trim(),
			...(field.description?.trim()
				? { description: field.description.trim() }
				: {}),
		});
	}

	return Array.from(deduped.values());
};

export const extractHandlebarsFieldNames = (
	...contents: string[]
): string[] => {
	const matches = new Set<string>();

	for (const content of contents) {
		for (const match of content.matchAll(HANDLEBARS_FIELD_PATTERN)) {
			const fieldName = match[1]?.trim();
			if (fieldName) {
				matches.add(fieldName);
			}
		}
	}

	return Array.from(matches.values());
};

export const hasImplicitQrCodePlaceholder = (html: string): boolean =>
	html.includes('{{qrCodeUrl}}') ||
	html.includes('*|QRCODE_URL|*') ||
	/<img\b[^>]*(?:alt|title)\s*=\s*['"][^'"]*qr[^'"]*['"][^>]*>/i.test(html);

const getValueAtPath = (
	target: Record<string, unknown>,
	path: string,
): unknown => {
	const parts = path.split('.').filter((part) => part.length > 0);
	let current: unknown = target;

	for (const part of parts) {
		if (!current || typeof current !== 'object' || Array.isArray(current)) {
			return undefined;
		}

		current = (current as Record<string, unknown>)[part];
	}

	return current;
};

const setValueAtPath = (
	target: Record<string, unknown>,
	path: string,
	value: string,
): void => {
	const parts = path.split('.').filter((part) => part.length > 0);
	let current: Record<string, unknown> = target;

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (index === parts.length - 1) {
			current[part] = value;
			return;
		}

		const next = current[part];
		if (!next || typeof next !== 'object' || Array.isArray(next)) {
			current[part] = {};
		}

		current = current[part] as Record<string, unknown>;
	}
};

export const buildEmailTemplateDataFromMappings = (
	fieldMappings: EmailTemplateFieldDefinition[],
	runtimeData: EmailTemplateRuntimeData,
): Record<string, unknown> => {
	const result: Record<string, unknown> = { ...runtimeData };

	for (const field of fieldMappings) {
		const mappingPath = field.mapping.trim() || field.name;
		const resolved = getValueAtPath(runtimeData, mappingPath);
		if (typeof resolved !== 'string') {
			continue;
		}

		setValueAtPath(result, field.name, resolved);
	}

	return result;
};

export const buildDirectTemplateDataFromFieldDefinitions = (
	fieldMappings: EmailTemplateFieldDefinition[],
): Record<string, unknown> => {
	const result: Record<string, unknown> = {};

	for (const field of fieldMappings) {
		setValueAtPath(result, field.name, field.sampleValue);

		if (field.name === 'contact.firstName') {
			setValueAtPath(result, 'firstName', field.sampleValue);
		}
	}

	return result;
};

export const renderTemplateWithFieldValues = (
	template: string,
	fieldMappings: EmailTemplateFieldDefinition[],
): string => {
	const templateData =
		buildDirectTemplateDataFromFieldDefinitions(fieldMappings);
	let renderedTemplate = template;

	for (const fieldName of extractHandlebarsFieldNames(template)) {
		const resolvedValue = getValueAtPath(templateData, fieldName);
		const replacementValue =
			typeof resolvedValue === 'string' ? resolvedValue : '';
		const tokenPattern = new RegExp(
			String.raw`{{\s*${escapeRegExp(fieldName)}\s*}}`,
			'g',
		);
		renderedTemplate = renderedTemplate.replace(
			tokenPattern,
			replacementValue,
		);
	}

	return renderedTemplate;
};

export const validateEmailTemplateFieldMappings = (
	deliveryProfile: EmailTemplateDeliveryProfile,
	subjectPart: string,
	html: string,
	fieldMappings: EmailTemplateFieldDefinition[],
): void => {
	const placeholders = extractHandlebarsFieldNames(subjectPart, html);
	const allowedRuntimeFields = new Set(
		EMAIL_TEMPLATE_RUNTIME_FIELDS[deliveryProfile],
	);
	const mappingsByName = new Map(
		fieldMappings.map((field) => [field.name, field]),
	);

	for (const placeholder of placeholders) {
		const mapping = mappingsByName.get(placeholder);
		if (!mapping) {
			throw new Error(
				`Missing field mapping for template placeholder ${placeholder}.`,
			);
		}

		const runtimeField = mapping.mapping.trim() || mapping.name;
		if (!allowedRuntimeFields.has(runtimeField)) {
			throw new Error(
				`Mapping ${runtimeField} is not supported for ${deliveryProfile}.`,
			);
		}
	}

	for (const field of fieldMappings) {
		const runtimeField = field.mapping.trim() || field.name;
		if (!allowedRuntimeFields.has(runtimeField)) {
			throw new Error(
				`Mapping ${runtimeField} is not supported for ${deliveryProfile}.`,
			);
		}
	}
};

export const readEmailTemplateHtml = async (
	storagePath: string,
): Promise<string> => {
	const [buffer] = await admin
		.storage()
		.bucket()
		.file(storagePath)
		.download();
	return buffer.toString('utf-8');
};

export const writeEmailTemplateHtml = async (
	storagePath: string,
	html: string,
): Promise<void> => {
	await admin.storage().bucket().file(storagePath).save(html, {
		contentType: 'text/html; charset=utf-8',
		resumable: false,
	});
};

export const deleteEmailTemplateHtml = async (
	storagePath: string,
): Promise<void> => {
	await admin.storage().bucket().file(storagePath).delete();
};

export const listEmailTemplateSummaries = async (): Promise<
	EmailTemplateSummary[]
> => {
	const snapshot = await admin
		.firestore()
		.collection(COLLECTION_SCHEMA.emailTemplates)
		.get();

	if (!snapshot?.docs) {
		return [];
	}

	return snapshot.docs
		.map((doc) => doc.data() as EmailTemplateSummary)
		.sort((left, right) =>
			left.displayName.localeCompare(right.displayName),
		);
};

export const getEmailTemplateSummary = async (
	key: string,
): Promise<EmailTemplateSummary | undefined> => {
	const snapshot = await admin
		.firestore()
		.doc(getEmailTemplateDocPath(key))
		.get();

	if (!snapshot.exists) {
		return undefined;
	}

	return snapshot.data() as EmailTemplateSummary;
};

export const listEmailTemplateSummariesByDeliveryProfile = async (
	deliveryProfile: EmailTemplateDeliveryProfile,
): Promise<EmailTemplateSummary[]> => {
	const templates = await listEmailTemplateSummaries();

	return templates
		.filter((template) => template.deliveryProfile === deliveryProfile)
		.sort((left, right) => {
			const leftTime = new Date(
				left.publishedOn || left.updatedOn,
			).getTime();
			const rightTime = new Date(
				right.publishedOn || right.updatedOn,
			).getTime();
			return rightTime - leftTime;
		});
};

export const listEmailTemplateRevisions = async (
	key: string,
): Promise<EmailTemplateRevision[]> => {
	const snapshot = await admin
		.firestore()
		.collection(getEmailTemplateRevisionCollectionPath(key))
		.get();

	return snapshot.docs
		.map((doc) => doc.data() as EmailTemplateRevision)
		.sort((left, right) => right.revisionNumber - left.revisionNumber);
};

export const getEmailTemplateRevision = async (
	key: string,
	revisionId: string,
): Promise<EmailTemplateRevision | undefined> => {
	const snapshot = await admin
		.firestore()
		.doc(getEmailTemplateRevisionDocPath(key, revisionId))
		.get();

	if (!snapshot.exists) {
		return undefined;
	}

	return snapshot.data() as EmailTemplateRevision;
};

const ensureMetaCharset = (html: string): string => {
	if (/<meta\s+charset\s*=\s*["']?utf-8/i.test(html)) {
		return html;
	}

	if (/<head[^>]*>/i.test(html)) {
		return html.replace(/<head([^>]*)>/i, '<head$1><meta charset="utf-8">');
	}

	return `<meta charset="utf-8">${html}`;
};

const normalizeContactFields = (html: string): string =>
	html.replace(/\bcontact\.firstName\b/g, 'firstName');

const replaceLegacyQrCodeTokens = (html: string): string =>
	html.replace(/\*\|QRCODE_URL\|\*/gi, '{{qrCodeUrl}}');

const replaceQrCodeImageSource = (html: string): string => {
	if (html.includes('{{qrCodeUrl}}')) {
		return html;
	}

	return html.replace(/<img\b([^>]*?)>/gi, (match, attributes: string) => {
		if (!/\bsrc\s*=\s*/i.test(attributes)) {
			return match;
		}

		if (!/(?:alt|title)\s*=\s*["'][^"']*qr[^"']*["']/i.test(attributes)) {
			return match;
		}

		const updatedAttributes = attributes.replace(
			/\bsrc\s*=\s*(['"]).*?\1/i,
			'src="{{qrCodeUrl}}"',
		);

		return `<img ${updatedAttributes.trim()}>`;
	});
};

const stripEditorWhitespace = (html: string): string =>
	html
		.replace(/\r\n|\n|\r|\t/gm, '')
		.replace(/>\s+</g, '><')
		.trim();

export const prepareEmailTemplateHtmlForSes = (html: string): string => {
	const withCharset = ensureMetaCharset(html);
	const withNormalizedFields = normalizeContactFields(withCharset);
	const withLegacyQrTokens = replaceLegacyQrCodeTokens(withNormalizedFields);
	const withQrImageSource = replaceQrCodeImageSource(withLegacyQrTokens);

	return stripEditorWhitespace(withQrImageSource);
};

export const resolvePublishedEmailTemplate = async (
	reference: EmailTemplateReferenceLike,
	defaultTemplateName = REGISTRATION_EMAIL_TEMPLATE,
): Promise<ResolvedPublishedEmailTemplate> => {
	if (reference.template?.trim()) {
		return {
			templateName: reference.template.trim(),
			usedLegacyFallback: false,
		};
	}

	if (!reference.templateKey?.trim()) {
		return {
			templateName: defaultTemplateName,
			usedLegacyFallback: false,
		};
	}

	const key = reference.templateKey.trim();
	if (isEmailTemplateDeliveryProfile(key)) {
		const matchingTemplates =
			await listEmailTemplateSummariesByDeliveryProfile(key);
		const publishedTemplate = matchingTemplates.find(
			(template) => !!template.publishedRevisionId,
		);

		if (publishedTemplate) {
			return {
				templateName: publishedTemplate.awsTemplateName,
				templateSummary: publishedTemplate,
				usedLegacyFallback: false,
			};
		}

		if (matchingTemplates.length === 0) {
			const fallback = FALLBACK_TEMPLATE_NAMES[key];
			if (fallback) {
				return {
					templateName: fallback,
					usedLegacyFallback: true,
				};
			}
		}

		throw new Error(
			`Template delivery profile ${key} does not have a published SES template available.`,
		);
	}

	const summary = await getEmailTemplateSummary(key);
	if (summary?.publishedRevisionId) {
		return {
			templateName: summary.awsTemplateName,
			templateSummary: summary,
			usedLegacyFallback: false,
		};
	}

	throw new Error(
		`Template ${key} does not have a published SES template available.`,
	);
};
