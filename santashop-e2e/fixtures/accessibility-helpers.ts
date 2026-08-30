import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Runs automated WCAG 2.2 AA checks against the currently rendered page. Every
 * reported violation fails the suite so lower-impact regressions cannot ship.
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
	const blockingViolations = results.violations;
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
