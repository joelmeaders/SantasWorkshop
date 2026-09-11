import { expect, waitFor } from 'storybook/test';

export async function scrollToReportTable(table: HTMLElement): Promise<void> {
	await document.fonts.ready;
	// Responsive charts above a report can resize after Angular renders its table.
	await waitFor(
		async (): Promise<void> => {
			const before = table.getBoundingClientRect();
			await new Promise<void>((resolve) =>
				window.setTimeout(resolve, 300),
			);
			const after = table.getBoundingClientRect();
			await expect([after.top, after.width, after.height]).toEqual([
				before.top,
				before.width,
				before.height,
			]);
		},
		{ timeout: 5_000 },
	);
	table.scrollIntoView({ block: 'start', behavior: 'instant' });
}
