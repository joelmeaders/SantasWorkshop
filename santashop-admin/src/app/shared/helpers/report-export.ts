export type ReportCell = string | number | null | undefined;

/** Quote every cell and prevent spreadsheet applications from evaluating text. */
export function createReportCsv(
	rows: readonly (readonly ReportCell[])[],
): string {
	return rows
		.map((row) =>
			row
				.map((value) => {
					let text = value == null ? 'Unavailable' : String(value);

					if (
						typeof value === 'string' &&
						// eslint-disable-next-line no-control-regex -- Spreadsheet formula prefixes can follow control characters.
						/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)
					) {
						text = `'${text}`;
					}
					return `"${text.replace(/"/g, '""')}"`;
				})
				.join(','),
		)
		.join('\r\n');
}

export function reportFilename(name: string): string {
	const safeName = name
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 100);
	return `${safeName || 'report'}.csv`;
}

export function downloadReportCsv(
	name: string,
	rows: readonly (readonly ReportCell[])[],
): void {
	const url = URL.createObjectURL(
		new Blob(['\uFEFF', createReportCsv(rows)], {
			type: 'text/csv;charset=utf-8',
		}),
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = reportFilename(name);
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Firestore Lite returns Timestamp objects; older fixtures and saved reports use Dates. */
export function reportDate(value: unknown): Date | undefined {
	try {
		let date: Date | undefined;
		if (value instanceof Date) {
			date = value;
		} else if (
			typeof value === 'string' &&
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
				value,
			)
		) {
			date = new Date(value);
		} else if (
			value &&
			typeof value === 'object' &&
			'toDate' in value &&
			typeof value.toDate === 'function'
		) {
			date = value.toDate();
		}
		return date instanceof Date && Number.isFinite(date.valueOf())
			? date
			: undefined;
	} catch {
		return undefined;
	}
}
