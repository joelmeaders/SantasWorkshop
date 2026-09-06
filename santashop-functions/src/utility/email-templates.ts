import {
	customerLanguageOrEnglish,
	isCustomerLanguage,
	type CustomerLanguage,
} from '@santashop/models';
import type {
	EmailTemplateDeliveryProfile,
	EmailTemplateFieldDefinition,
	EmailTemplateRevision,
	EmailTemplateSummary,
} from '@santashop/models';
import {
	COLLECTION_SCHEMA,
	EMAIL_TEMPLATE_DELIVERY_PROFILES,
	EMAIL_TEMPLATE_RUNTIME_FIELDS,
} from '@santashop/models';
import admin from '../firebase-admin';
import { normalizeDateTime, type DateTimeValue } from './date-time-format';
import { CallableValidationError } from './callable-validation';

export interface EmailTemplateReferenceLike {
	templateKey?: string;
	language?: CustomerLanguage;
}

export interface EmailTemplateRuntimeData {
	firstName: string;
	eventName: string;
	qrCodeUrl?: string;
	code?: string;
	dateTime: string;
}

export interface ResolvedPublishedEmailTemplate {
	templateName: string;
	templateSummary: EmailTemplateSummary;
	language: CustomerLanguage;
	fallbackReason?: string;
}

const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AWS_TEMPLATE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_TEMPLATE_STORAGE_ROOT = 'emailTemplates';
const HANDLEBARS_TOKEN_PATTERN = /{{[\s\S]*?}}/g;
const FIELD_PATH_PATTERN = /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/;
const HANDLEBARS_FIELD_PATTERN = new RegExp(
	String.raw`^{{\s*(${FIELD_PATH_PATTERN.source.slice(1, -1)})\s*}}$`,
);
const UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE =
	'Only plain Handlebars placeholders like {{field}} are supported.';
const UNSAFE_FIELD_SEGMENTS = new Set([
	'__proto__',
	'constructor',
	'prototype',
]);

const isSafeFieldPath = (value: string): boolean =>
	FIELD_PATH_PATTERN.test(value) &&
	value.split('.').every((segment) => !UNSAFE_FIELD_SEGMENTS.has(segment));

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
		throw new CallableValidationError(
			'Template key must use lowercase letters, numbers, and hyphens only.',
		);
	}

	return normalized;
};

export const isEmailTemplateDeliveryProfile = (
	value: string,
): value is EmailTemplateDeliveryProfile => DELIVERY_PROFILE_VALUES.has(value);

export const normalizeEmailTemplateDeliveryProfile = (
	value: unknown,
): EmailTemplateDeliveryProfile => {
	if (typeof value !== 'string') {
		throw new CallableValidationError('Delivery profile must be a string.');
	}

	const normalized = value.trim().toLowerCase();
	if (!isEmailTemplateDeliveryProfile(normalized)) {
		throw new CallableValidationError(
			`Unsupported email template delivery profile: ${value}`,
		);
	}

	return normalized;
};

export const normalizeAwsTemplateName = (value: string): string => {
	const normalized = value.trim();

	if (!AWS_TEMPLATE_NAME_PATTERN.test(normalized)) {
		throw new CallableValidationError(
			'AWS template name must be 1-64 characters using letters, numbers, underscores, or hyphens.',
		);
	}

	return normalized;
};

export const normalizeEmailTemplateFieldDefinitions = (
	fields: EmailTemplateFieldDefinition[],
): EmailTemplateFieldDefinition[] => {
	if (!Array.isArray(fields)) {
		throw new CallableValidationError('Field mappings must be an array.');
	}

	const deduped = new Map<string, EmailTemplateFieldDefinition>();
	const normalizeFieldValue = (
		value: unknown,
		label: string,
	): string | undefined => {
		if (value === undefined || value === null) {
			return undefined;
		}

		if (typeof value !== 'string') {
			throw new CallableValidationError(`${label} must be a string.`);
		}

		return value.trim();
	};

	for (const [index, field] of fields.entries()) {
		if (
			typeof field !== 'object' ||
			field === null ||
			Array.isArray(field)
		) {
			throw new CallableValidationError(
				`Field mapping ${index + 1} must be an object.`,
			);
		}

		const fieldRecord = field as Record<string, unknown>;
		const name =
			normalizeFieldValue(
				fieldRecord['name'],
				`Field mapping ${index + 1} name`,
			) ?? '';
		if (!name) {
			continue;
		}
		if (!isSafeFieldPath(name)) {
			throw new CallableValidationError(
				`Field mapping ${index + 1} name must use letters, numbers, underscores, and dots without empty path segments.`,
			);
		}

		const mapping =
			normalizeFieldValue(
				fieldRecord['mapping'],
				`Field mapping ${index + 1} mapping`,
			) ?? '';
		if (mapping && !isSafeFieldPath(mapping)) {
			throw new CallableValidationError(
				`Field mapping ${index + 1} mapping must use letters, numbers, underscores, and dots without empty path segments.`,
			);
		}

		deduped.set(name, {
			name,
			mapping,
			sampleValue:
				normalizeFieldValue(
					fieldRecord['sampleValue'],
					`Field mapping ${index + 1} sample value`,
				) ?? '',
			...(normalizeFieldValue(
				fieldRecord['description'],
				`Field mapping ${index + 1} description`,
			)
				? {
						description: normalizeFieldValue(
							fieldRecord['description'],
							`Field mapping ${index + 1} description`,
						) as string,
					}
				: {}),
		});
	}

	return Array.from(deduped.values());
};

const validateHandlebarsContent = (content: string): void => {
	if (typeof content !== 'string') {
		throw new CallableValidationError('Template content must be a string.');
	}

	let cursor = 0;
	while (cursor < content.length) {
		const openIndex = content.indexOf('{{', cursor);
		const closeBeforeOpen = content.indexOf('}}', cursor);
		if (
			closeBeforeOpen >= 0 &&
			(openIndex < 0 || closeBeforeOpen < openIndex)
		) {
			throw new CallableValidationError(
				UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE,
			);
		}
		if (openIndex < 0) {
			return;
		}

		const closeIndex = content.indexOf('}}', openIndex + 2);
		if (closeIndex < 0) {
			throw new CallableValidationError(
				UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE,
			);
		}

		const token = content.slice(openIndex, closeIndex + 2);
		const fieldName = token.match(HANDLEBARS_FIELD_PATTERN)?.[1];
		if (
			!fieldName ||
			!isSafeFieldPath(fieldName) ||
			content[closeIndex + 2] === '}'
		) {
			throw new CallableValidationError(
				UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE,
			);
		}

		cursor = closeIndex + 2;
		if (content.indexOf('}}', cursor) === cursor) {
			throw new CallableValidationError(
				UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE,
			);
		}
	}
};

export const validateHandlebarsSyntax = (...contents: string[]): void => {
	for (const content of contents) {
		validateHandlebarsContent(content);
	}
};

export const extractHandlebarsFieldNames = (
	...contents: string[]
): string[] => {
	validateHandlebarsSyntax(...contents);
	const matches = new Set<string>();

	for (const content of contents) {
		for (const token of content.matchAll(HANDLEBARS_TOKEN_PATTERN)) {
			const fieldName = token[0].match(HANDLEBARS_FIELD_PATTERN)?.[1];
			if (fieldName) matches.add(fieldName);
		}
	}

	return Array.from(matches.values());
};

const getValueAtPath = (
	target: Record<string, unknown>,
	path: string,
): unknown => {
	if (!isSafeFieldPath(path)) return undefined;
	const parts = path.split('.');
	let current: unknown = target;

	for (const part of parts) {
		if (
			!current ||
			typeof current !== 'object' ||
			Array.isArray(current) ||
			!Object.prototype.hasOwnProperty.call(current, part)
		) {
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
	if (!isSafeFieldPath(path)) return;
	const parts = path.split('.');
	let current: Record<string, unknown> = target;

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (index === parts.length - 1) {
			current[part] = value;
			return;
		}

		const next = Object.prototype.hasOwnProperty.call(current, part)
			? current[part]
			: undefined;
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
	}

	return result;
};

export const renderTemplateWithFieldValues = (
	template: string,
	fieldMappings: EmailTemplateFieldDefinition[],
): string => {
	validateHandlebarsSyntax(template);
	const templateData =
		buildDirectTemplateDataFromFieldDefinitions(fieldMappings);

	return template.replace(HANDLEBARS_TOKEN_PATTERN, (token) => {
		const fieldName = token.match(HANDLEBARS_FIELD_PATTERN)?.[1];
		if (!fieldName) return token;

		const resolvedValue = getValueAtPath(templateData, fieldName);
		return typeof resolvedValue === 'string' ? resolvedValue : '';
	});
};

export const validateEmailTemplateFieldMappings = (
	deliveryProfile: EmailTemplateDeliveryProfile,
	subjectPart: string,
	html: string,
	fieldMappings: EmailTemplateFieldDefinition[],
): void => {
	if (!isEmailTemplateDeliveryProfile(deliveryProfile)) {
		throw new CallableValidationError(
			`Unsupported email template delivery profile: ${String(deliveryProfile)}`,
		);
	}

	validateHandlebarsSyntax(subjectPart, html);
	const placeholders = extractHandlebarsFieldNames(subjectPart, html);
	const allowedRuntimeFields = new Set(
		EMAIL_TEMPLATE_RUNTIME_FIELDS[deliveryProfile],
	);
	const normalizedFieldMappings =
		normalizeEmailTemplateFieldDefinitions(fieldMappings);
	const mappingsByName = new Map(
		normalizedFieldMappings.map((field) => [field.name, field]),
	);

	for (const placeholder of placeholders) {
		const mapping = mappingsByName.get(placeholder);
		if (!mapping) {
			throw new CallableValidationError(
				`Missing field mapping for template placeholder ${placeholder}.`,
			);
		}

		const runtimeField = mapping.mapping.trim() || mapping.name;
		if (!allowedRuntimeFields.has(runtimeField)) {
			throw new CallableValidationError(
				`Mapping ${runtimeField} is not supported for ${deliveryProfile}.`,
			);
		}
	}

	for (const field of normalizedFieldMappings) {
		const runtimeField = field.mapping.trim() || field.name;
		if (!allowedRuntimeFields.has(runtimeField)) {
			throw new CallableValidationError(
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
			const leftTime = normalizeDateTime(
				(left.publishedOn || left.updatedOn) as DateTimeValue,
			).getTime();
			const rightTime = normalizeDateTime(
				(right.publishedOn || right.updatedOn) as DateTimeValue,
			).getTime();
			return rightTime - leftTime || left.key.localeCompare(right.key);
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

const stripEditorWhitespace = (html: string): string =>
	html
		.replace(/\r\n|\n|\r|\t/gm, '')
		.replace(/>\s+</g, '><')
		.trim();

export const prepareEmailTemplateHtmlForSes = (html: string): string =>
	stripEditorWhitespace(ensureMetaCharset(html));

export const normalizeEmailLanguage = (value: unknown): CustomerLanguage => {
	if (value === undefined) return 'en';
	if (!isCustomerLanguage(value))
		throw new CallableValidationError('Language must be en or es.');
	return value;
};

export const resolvePublishedEmailTemplate = async (
	reference: EmailTemplateReferenceLike,
): Promise<ResolvedPublishedEmailTemplate> => {
	const key = reference.templateKey?.trim();
	if (!key)
		throw new Error('A published email template reference is required.');
	const requested = customerLanguageOrEnglish(reference.language);
	const candidates = isEmailTemplateDeliveryProfile(key)
		? await listEmailTemplateSummariesByDeliveryProfile(key)
		: [await getEmailTemplateSummary(key)].filter(
				(item): item is EmailTemplateSummary => !!item,
			);
	for (const language of requested === 'es'
		? (['es', 'en'] as const)
		: (['en'] as const)) {
		for (const summary of candidates) {
			if (
				!summary.publishedRevisionId ||
				customerLanguageOrEnglish(summary.language) !== language
			)
				continue;
			const revision = await getEmailTemplateRevision(
				summary.key,
				summary.publishedRevisionId,
			);
			if (!revision)
				throw new Error(
					`Published revision for template ${summary.key} is unavailable.`,
				);
			if (
				customerLanguageOrEnglish(revision.language) !== language ||
				revision.deliveryProfile !== summary.deliveryProfile
			) {
				throw new Error(
					'Published template language or delivery profile does not match.',
				);
			}
			return {
				templateName: summary.awsTemplateName,
				templateSummary: {
					...summary,
					subjectPart: revision.subjectPart,
					fieldMappings: revision.fieldMappings,
					textPart: revision.textPart,
				},
				language,
				...(language !== requested
					? {
							fallbackReason:
								'No published Spanish template is available.',
						}
					: {}),
			};
		}
	}
	throw new Error(
		`Template ${key} does not have a published SES template available.`,
	);
};
