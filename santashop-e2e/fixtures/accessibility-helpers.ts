import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

/**
 * Runs automated WCAG checks against the currently rendered page. Moderate and
 * minor findings remain available in the Playwright trace, while violations
 * that can prevent customers or staff from completing a task fail the suite.
 */
export const expectNoBlockingAccessibilityViolations = async (
	page: Page,
): Promise<void> => {
	await page.locator('ion-router-outlet').evaluateAll(async (outlets) => {
		const animations = outlets.flatMap((outlet) =>
			outlet.getAnimations({ subtree: true }),
		);
		await Promise.all(
			animations.map((animation) =>
				animation.finished.catch(() => undefined),
			),
		);
	});

	const results = await new AxeBuilder({ page })
		.withTags([
			'wcag2a',
			'wcag2aa',
			'wcag21a',
			'wcag21aa',
			'wcag22aa',
		])
		.analyze();
	const blockingViolations = results.violations.filter(
		(violation) =>
			typeof violation.impact === 'string' &&
			BLOCKING_IMPACTS.has(violation.impact),
	);
	const summary = blockingViolations
		.map(
			(violation) =>
				`${violation.id}: ${violation.help}\n${violation.nodes
					.map((node) => `  ${node.target.join(' ')}: ${node.failureSummary}`)
					.join('\n')}`,
		)
		.join('\n\n');

	expect(blockingViolations, summary).toEqual([]);
};
