import type { EmailTemplateFieldDefinition } from '@santashop/models';

const HANDLEBARS_TOKEN_PATTERN = /{{[\s\S]*?}}/g;
const FIELD_PATH_PATTERN = /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/;
const HANDLEBARS_VALUE_PATTERN =
	/{{\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\s*}}/g;
const FIELD_NAME_PATTERN = FIELD_PATH_PATTERN;
const PLAIN_HANDLEBARS_TOKEN_PATTERN = new RegExp(
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

const validateHandlebarsContent = (content: string): void => {
	let cursor = 0;
	while (cursor < content.length) {
		const openIndex = content.indexOf('{{', cursor);
		const closeBeforeOpen = content.indexOf('}}', cursor);
		if (
			closeBeforeOpen >= 0 &&
			(openIndex < 0 || closeBeforeOpen < openIndex)
		) {
			throw new Error(UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE);
		}
		if (openIndex < 0) {
			return;
		}

		const closeIndex = content.indexOf('}}', openIndex + 2);
		if (closeIndex < 0) {
			throw new Error(UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE);
		}

		const token = content.slice(openIndex, closeIndex + 2);
		const fieldName = token.match(PLAIN_HANDLEBARS_TOKEN_PATTERN)?.[1];
		if (
			!fieldName ||
			!isSafeFieldPath(fieldName) ||
			content[closeIndex + 2] === '}'
		) {
			throw new Error(UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE);
		}

		cursor = closeIndex + 2;
		if (content.indexOf('}}', cursor) === cursor) {
			throw new Error(UNSUPPORTED_HANDLEBARS_SYNTAX_MESSAGE);
		}
	}
};

export const validateHandlebarsSyntax = (content: string): void => {
	validateHandlebarsContent(content);
};

const toSampleLabel = (fieldName: string): string => {
	const tail = fieldName.split('.').at(-1) ?? fieldName;
	return tail
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (value) => value.toUpperCase())
		.trim();
};

const isUnsafeProperty = (property: string): boolean =>
	property === '__proto__' ||
	property === 'constructor' ||
	property === 'prototype';

const setNestedValue = (
	target: Record<string, unknown>,
	path: string,
	value: string,
): void => {
	if (!isSafeFieldPath(path)) return;
	const parts = path.split('.');
	let current: Record<string, unknown> = target;

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (!part) {
			continue;
		}
		if (isUnsafeProperty(part)) {
			return;
		}

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

const buildSourceDataFromMappings = (
	fields: EmailTemplateFieldDefinition[],
): Record<string, unknown> => {
	const sourceData: Record<string, unknown> = {};

	for (const field of fields) {
		setNestedValue(sourceData, field.name, field.sampleValue);
	}

	return sourceData;
};

const getNestedValue = (
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
			isUnsafeProperty(part) ||
			!Object.prototype.hasOwnProperty.call(current, part)
		) {
			return undefined;
		}

		current = (current as Record<string, unknown>)[part];
	}

	return current;
};

const valueToString = (value: unknown): string => {
	if (value === undefined || value === null) {
		return '';
	}

	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}

	return String(value);
};

const escapeHtml = (value: unknown): string =>
	valueToString(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#x27;')
		.replaceAll('`', '&#x60;')
		.replaceAll('=', '&#x3D;');

const renderInterpolations = (
	html: string,
	sampleData: Record<string, unknown>,
): string => {
	return html.replace(
		HANDLEBARS_VALUE_PATTERN,
		(_fullMatch: string, fieldName: string) =>
			valueToString(getNestedValue(sampleData, fieldName)),
	);
};

export const extractHandlebarsFieldNames = (html: string): string[] => {
	const matches = new Set<string>();
	for (const token of html.matchAll(HANDLEBARS_TOKEN_PATTERN)) {
		const fieldName = token[0].match(PLAIN_HANDLEBARS_TOKEN_PATTERN)?.[1];
		if (fieldName && FIELD_NAME_PATTERN.test(fieldName)) {
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

	return detectedFieldNames.map((name) => {
		const current = byName.get(name);
		return {
			name,
			mapping: current?.mapping ?? name,
			sampleValue:
				current?.sampleValue ??
				(name === 'qrCodeUrl'
					? 'https://example.com/qr-code.png'
					: `Sample ${toSampleLabel(name)}`),
			...(current?.description
				? { description: current.description }
				: {}),
		};
	});
};

export const renderEmailTemplatePreview = (
	html: string,
	fields: EmailTemplateFieldDefinition[],
): string => {
	try {
		if (!html.trim()) {
			return '';
		}

		const sampleData: Record<string, unknown> = {};
		validateHandlebarsSyntax(html);
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

		return renderInterpolations(html, sampleData);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return `<html><body><pre>${escapeHtml(message)}</pre></body></html>`;
	}
};
