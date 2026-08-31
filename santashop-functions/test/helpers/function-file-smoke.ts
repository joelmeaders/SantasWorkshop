import { expect } from 'vitest';

type DefaultExportModule = {
	default: unknown;
};

type NamedExportModule = Record<string, unknown>;

export const assertDefaultExportFunction = async (
	loader: () => Promise<DefaultExportModule>,
): Promise<void> => {
	const module = await loader();
	expect(module.default).toBeTypeOf('function');
};

export const assertNamedExportFunctions = async (
	loader: () => Promise<NamedExportModule>,
	exportNames: string[],
): Promise<void> => {
	const module = await loader();
	exportNames.forEach((exportName) => {
		expect(module[exportName]).toBeTypeOf('function');
	});
};
