import type { EmailTemplateFieldDefinition } from '@santashop/models';
import Handlebars from 'handlebars';

const HANDLEBARS_FIELD_PATTERN = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
const IMPLICIT_QR_CODE_PATTERN =
	/<img\b[^>]*(?:alt|title)\s*=\s*['"][^'"]*qr[^'"]*['"][^>]*>/i;

const toSampleLabel = (fieldName: string): string => {
	const tail = fieldName.split('.').at(-1) ?? fieldName;
	return tail
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (value) => value.toUpperCase())
		.trim();
};

const setNestedValue = (
	target: Record<string, unknown>,
	path: string,
	value: string,
): void => {
	const parts = path.split('.');
	let current: Record<string, unknown> = target;

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (!part) {
			continue;
		}

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

const normalizeFieldName = (value: string): string =>
	value.replace(/\bcontact\.firstName\b/g, 'firstName');

const buildSourceDataFromMappings = (
	fields: EmailTemplateFieldDefinition[],
): Record<string, unknown> => {
	const sourceData: Record<string, unknown> = {};

	for (const field of fields) {
		setNestedValue(sourceData, field.name, field.sampleValue);

		const normalizedFieldName = normalizeFieldName(field.name);
		if (normalizedFieldName !== field.name) {
			setNestedValue(sourceData, normalizedFieldName, field.sampleValue);
		}
	}

	return sourceData;
};

const getNestedValue = (
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

export const extractHandlebarsFieldNames = (html: string): string[] => {
	const matches = new Set<string>();
	for (const match of html.matchAll(HANDLEBARS_FIELD_PATTERN)) {
		const fieldName = match[1]?.trim();
		if (fieldName) {
			matches.add(fieldName);
		}
	}

	return Array.from(matches.values());
};

export const mergeTemplateFieldDefinitions = (
	html: string,
	subjectPart: string,
	existing: EmailTemplateFieldDefinition[],
): EmailTemplateFieldDefinition[] => {
	const byName = new Map(existing.map((field) => [field.name, field]));
	const detectedFieldNames = extractHandlebarsFieldNames(
		[html, subjectPart].join('\n'),
	);

	if (IMPLICIT_QR_CODE_PATTERN.test(html) && !detectedFieldNames.includes('qrCodeUrl')) {
		detectedFieldNames.push('qrCodeUrl');
	}

	return detectedFieldNames.map(
		(name) => {
		const current = byName.get(name);
		return {
			name,
			mapping: current?.mapping ?? name,
			sampleValue:
				current?.sampleValue ??
				(name === 'qrCodeUrl'
					? 'https://example.com/qr-code.png'
					: `Sample ${toSampleLabel(name)}`),
			...(current?.description ? { description: current.description } : {}),
		};
		},
	);
};

export const renderEmailTemplatePreview = (
	html: string,
	fields: EmailTemplateFieldDefinition[],
): string => {
	try {
		const sampleData: Record<string, unknown> = {};
		const sourceData = buildSourceDataFromMappings(fields);
		for (const field of fields) {
			const resolvedValue = getNestedValue(
				sourceData,
				field.mapping.trim() || field.name,
			);
			setNestedValue(
				sampleData,
				field.name,
				typeof resolvedValue === 'string'
					? resolvedValue
					: field.sampleValue,
			);
		}

		const template = Handlebars.compile(html, {
			strict: false,
		});
		return template(sampleData);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return `<html><body><pre>${message}</pre></body></html>`;
	}
};
