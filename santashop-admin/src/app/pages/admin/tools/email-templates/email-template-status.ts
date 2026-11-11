import type { EmailTemplateSummary } from '@santashop/models';

/** Mirrors runtime delivery selection: newest publication per profile and language. */
export function currentDeliveryTemplateKeys(
	templates: EmailTemplateSummary[],
): Set<string> {
	const selected = new Set<string>();
	const groups = new Set<string>();
	const published = templates.filter(
		(template) => !!template.publishedRevisionId,
	);
	published.sort(
		(left, right) =>
			publicationTime(right) - publicationTime(left) ||
			left.key.localeCompare(right.key),
	);
	for (const template of published) {
		const group = `${template.deliveryProfile}:${template.language ?? 'en'}`;
		if (groups.has(group)) continue;
		groups.add(group);
		selected.add(template.key);
	}
	return selected;
}

function publicationTime(template: EmailTemplateSummary): number {
	const value: unknown = template.publishedOn || template.updatedOn;
	if (typeof value === 'object' && value !== null) {
		if ('_seconds' in value && typeof value._seconds === 'number')
			return (
				value._seconds * 1000 +
				Math.floor(
					Number('_nanoseconds' in value ? value._nanoseconds : 0) /
						1_000_000,
				)
			);
		if ('seconds' in value && typeof value.seconds === 'number')
			return (
				value.seconds * 1000 +
				Math.floor(
					Number('nanoseconds' in value ? value.nanoseconds : 0) /
						1_000_000,
				)
			);
	}
	return new Date(value as Date | string).getTime();
}
