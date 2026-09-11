import {
	EMAIL_TEMPLATE_RUNTIME_FIELDS,
	isCustomerLanguage,
	type EmailTemplateDeliveryProfile,
	type EmailTemplatePackage,
	type SaveEmailTemplateRevisionRequest,
} from '@santashop/models';
import {
	mergeTemplateFieldDefinitions,
	validateHandlebarsSyntax,
} from './email-template-editor.helpers';

export const MAX_TEMPLATE_FILE_BYTES = 1_000_000;

const record = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Expected a template object.');
	return value as Record<string, unknown>;
};

const stringField = (
	source: Record<string, unknown>,
	name: string,
	optional = false,
): string => {
	const value = source[name];
	if (optional && value === undefined) return '';
	if (typeof value !== 'string' || (!optional && !value.trim()))
		throw new Error(`Invalid template field: ${name}.`);
	return value;
};

export const validateTemplateHtml = (html: string): void => {
	if (!html.trim()) throw new Error('The HTML file is empty.');
	if (new TextEncoder().encode(html).length > 500_000)
		throw new Error('Template content must not exceed 500 KB.');
	validateHandlebarsSyntax(html);
};

export const parseTemplatePackage = (
	content: string,
): SaveEmailTemplateRevisionRequest => {
	if (new TextEncoder().encode(content).length > MAX_TEMPLATE_FILE_BYTES)
		throw new Error('Template files must not exceed 1 MB.');
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new Error(
			'The template could not be read. Expected a JSON template file. Reload the page and try again, or check the imported file.',
		);
	}
	const envelope = record(parsed);
	if (
		envelope['format'] !== 'santashop-email-template' ||
		envelope['version'] !== 1
	)
		throw new Error('Unsupported template package format or version.');
	const source = record(envelope['template']);
	const deliveryProfile = stringField(
		source,
		'deliveryProfile',
	) as EmailTemplateDeliveryProfile;
	if (!Object.hasOwn(EMAIL_TEMPLATE_RUNTIME_FIELDS, deliveryProfile))
		throw new Error('Unsupported delivery profile.');
	if (!isCustomerLanguage(source['language']))
		throw new Error('Language must be en or es.');
	for (const name of ['seasonalReviewRequired', 'seasonalDetailsReviewed']) {
		if (source[name] !== undefined && typeof source[name] !== 'boolean')
			throw new Error(`Invalid template field: ${name}.`);
	}
	const html = stringField(source, 'html');
	const subjectPart = stringField(source, 'subjectPart');
	const textPart = stringField(source, 'textPart', true);
	validateTemplateHtml(html);
	validateHandlebarsSyntax(subjectPart + '\n' + textPart);
	if (new TextEncoder().encode(html + textPart).length > 500_000)
		throw new Error('Template content must not exceed 500 KB.');
	if (!Array.isArray(source['fieldMappings']))
		throw new Error('Field mappings must be an array.');
	const fieldMappings = source['fieldMappings'].map((value: unknown) => {
		const field = record(value);
		const name = stringField(field, 'name');
		validateHandlebarsSyntax(`{{${name}}}`);
		const mapping = stringField(field, 'mapping', true) || name;
		if (!EMAIL_TEMPLATE_RUNTIME_FIELDS[deliveryProfile].includes(mapping))
			throw new Error(`Unsupported runtime field: ${mapping}.`);
		return {
			name,
			mapping,
			sampleValue: stringField(field, 'sampleValue', true),
			description: stringField(field, 'description', true),
		};
	});
	const names = new Set(fieldMappings.map((field) => field.name));
	if (names.size !== fieldMappings.length)
		throw new Error('Field mappings must have unique names.');
	const detected = mergeTemplateFieldDefinitions(
		html + '\n' + textPart,
		subjectPart,
		fieldMappings,
	);
	if (detected.some((field) => !names.has(field.name)))
		throw new Error('Every placeholder needs a field mapping.');
	return {
		key: stringField(source, 'key'),
		deliveryProfile,
		language: source['language'],
		displayName: stringField(source, 'displayName'),
		awsTemplateName: stringField(source, 'awsTemplateName'),
		description: stringField(source, 'description', true),
		notes: stringField(source, 'notes', true),
		subjectPart,
		html,
		textPart,
		fieldMappings,
		seasonalReviewRequired: source['seasonalReviewRequired'] === true,
		seasonalDetailsReviewed: source['seasonalDetailsReviewed'] === true,
	};
};

export const serializeTemplatePackage = (
	draft: SaveEmailTemplateRevisionRequest,
): string => {
	const template: SaveEmailTemplateRevisionRequest = {
		key: draft.key,
		displayName: draft.displayName,
		deliveryProfile: draft.deliveryProfile,
		language: draft.language ?? 'en',
		awsTemplateName: draft.awsTemplateName,
		description: draft.description ?? '',
		notes: draft.notes ?? '',
		subjectPart: draft.subjectPart,
		html: draft.html,
		textPart: draft.textPart ?? '',
		fieldMappings: draft.fieldMappings.map(
			({ name, mapping, sampleValue, description }) => ({
				name,
				mapping,
				sampleValue,
				...(description ? { description } : {}),
			}),
		),
		seasonalReviewRequired: draft.seasonalReviewRequired === true,
		seasonalDetailsReviewed: draft.seasonalDetailsReviewed === true,
	};
	const envelope: EmailTemplatePackage = {
		format: 'santashop-email-template',
		version: 1,
		template,
	};
	const serialized = JSON.stringify(envelope, null, 2);
	parseTemplatePackage(serialized);
	return serialized;
};
