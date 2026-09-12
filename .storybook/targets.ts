export type StorybookTarget = 'app' | 'admin';

export function storybookTargets(
	value: string | undefined = process.env['STORYBOOK_TARGETS'],
): StorybookTarget[] {
	if (value === undefined) return ['app', 'admin'];
	const targets = value.split(',').map((target) => target.trim());
	if (targets.some((target) => target !== 'app' && target !== 'admin')) {
		throw new Error(
			'STORYBOOK_TARGETS must contain app, admin, or app,admin.',
		);
	}
	return [...new Set(targets)] as StorybookTarget[];
}

export function storybookTsconfig(targets: StorybookTarget[]): string {
	return targets.length === 1
		? `tsconfig.storybook.${targets[0]}.json`
		: 'tsconfig.storybook.json';
}

export function selectStorybookEntries<
	T extends { type: string; importPath?: string },
>(entries: T[], targets: StorybookTarget[]): T[] {
	const stories = entries.filter((entry) => entry.type === 'story');
	const selected = stories.filter((entry) => {
		const source = entry.importPath?.replaceAll('\\', '/');
		const owner = (['app', 'admin'] as const).find((target) =>
			source?.split('/').includes(`santashop-${target}`),
		);
		if (!owner) {
			throw new Error(
				`Storybook story has no known app source: ${source}`,
			);
		}
		return targets.includes(owner);
	});
	for (const target of targets) {
		if (
			!selected.some((entry) =>
				entry.importPath
					?.replaceAll('\\', '/')
					.split('/')
					.includes(`santashop-${target}`),
			)
		) {
			throw new Error(
				`Storybook index contains no stories for ${target}. Rebuild Storybook with the selected targets.`,
			);
		}
	}
	return selected;
}
