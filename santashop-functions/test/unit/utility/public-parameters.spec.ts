import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	createDefaultPublicParameters,
	parsePublicParameters,
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
	type PublicParameters,
} from '../../../src/models';

const requireFromTest = createRequire(import.meta.url);
const { verifyPublicParameters } = requireFromTest(
	'../../../../scripts/verify-public-parameters.cjs',
) as {
	verifyPublicParameters: (template: unknown) => {
		settings: PublicParameters;
		version: string;
	};
};
const { prepareCandidate, writeDefaults } = requireFromTest(
	'../../../../scripts/remote-config.cjs',
) as {
	prepareCandidate: (
		project: string,
		document: unknown,
		snapshot: unknown,
	) => Record<string, unknown>;
	writeDefaults: (
		project: string,
		snapshot: unknown,
		output: string,
	) => { version: string };
};

const managedParameter = (): object => ({
	valueType: 'JSON',
	defaultValue: { value: JSON.stringify(createDefaultPublicParameters()) },
});
const template = (): object => ({
	parameters: { [PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]: managedParameter() },
	version: { versionNumber: '42' },
});
const encode = (value: unknown): object => {
	if (typeof value === 'boolean') return { booleanValue: value };
	if (typeof value === 'string') return { stringValue: value };
	return {
		mapValue: {
			fields: Object.fromEntries(
				Object.entries(value as Record<string, unknown>).map(
					([key, child]) => [key, encode(child)],
				),
			),
		},
	};
};
const legacyDocument = (): object => ({
	name: 'projects/santas-workshop-test/databases/(default)/documents/parameters/public',
	...(encode(createDefaultPublicParameters()) as { mapValue: object })
		.mapValue,
});

describe('Remote Config public settings deployment verification', () => {
	it('validates the complete parameter and published version', () => {
		expect(verifyPublicParameters(template())).toEqual({
			settings: createDefaultPublicParameters(),
			version: '42',
		});
	});
	it('accepts a grouped parameter', () => {
		expect(
			verifyPublicParameters({
				parameterGroups: {
					controls: {
						parameters: {
							[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]:
								managedParameter(),
						},
					},
				},
			}).settings,
		).toEqual(createDefaultPublicParameters());
	});
	it('rejects duplicate or missing parameters', () => {
		expect(() => verifyPublicParameters({})).toThrow('exactly one');
		expect(() =>
			verifyPublicParameters({
				...template(),
				parameterGroups: {
					duplicate: {
						parameters: {
							[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]:
								managedParameter(),
						},
					},
				},
			}),
		).toThrow('exactly one');
	});
	it.each([
		{ valueType: 'STRING' },
		{ conditionalValues: { experiment: { value: '{}' } } },
		{ defaultValue: { useInAppDefault: true } },
	])('rejects incompatible parameter settings %j', (override) => {
		expect(() =>
			verifyPublicParameters({
				parameters: {
					[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]: {
						...managedParameter(),
						...override,
					},
				},
			}),
		).toThrow();
	});
	it('rejects malformed JSON', () => {
		expect(() =>
			verifyPublicParameters({
				parameters: {
					[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY]: {
						valueType: 'JSON',
						defaultValue: { value: '{' },
					},
				},
			}),
		).toThrow();
	});
	it('requires every boolean and string without coercion', () => {
		const defaults = createDefaultPublicParameters();
		for (const key of Object.keys(defaults)) {
			const missing = { ...defaults } as Record<string, unknown>;
			delete missing[key];
			expect(() => parsePublicParameters(missing)).toThrow();
		}
		for (const key of Object.keys(defaults.admin)) {
			expect(() =>
				parsePublicParameters({
					...defaults,
					admin: { ...defaults.admin, [key]: 'true' },
				}),
			).toThrow();
		}
		for (const key of Object.keys(defaults.globalAlert)) {
			expect(() =>
				parsePublicParameters({
					...defaults,
					globalAlert: { ...defaults.globalAlert, [key]: null },
				}),
			).toThrow();
		}
	});
	it('rejects extra fields and returns independent snapshots', () => {
		expect(() =>
			parsePublicParameters({
				...createDefaultPublicParameters(),
				hidden: true,
			}),
		).toThrow('unknown field');
		const source = createDefaultPublicParameters();
		const parsed = parsePublicParameters(source);
		parsed.admin.checkinEnabled = !source.admin.checkinEnabled;
		expect(source.admin.checkinEnabled).not.toBe(
			parsed.admin.checkinEnabled,
		);
	});
	it('preserves unrelated parameters and conditions in migration candidates', () => {
		const existing = {
			parameters: { other: { defaultValue: { value: 'unchanged' } } },
			conditions: [{ name: 'other', expression: 'true' }],
		};
		const candidate = prepareCandidate(
			'santas-workshop-test',
			legacyDocument(),
			{
				projectId: 'santas-workshop-test',
				etag: 'etag-40',
				template: existing,
			},
		);
		expect(candidate['conditions']).toEqual(existing.conditions);
		expect(
			(candidate['parameters'] as Record<string, unknown>)['other'],
		).toEqual(existing.parameters.other);
		expect(verifyPublicParameters(candidate).settings).toEqual(
			createDefaultPublicParameters(),
		);
	});
	it('rejects a cross-project source and refuses to overwrite migrated settings', () => {
		expect(() =>
			prepareCandidate('santas-workshop-193b5', legacyDocument(), {
				projectId: 'santas-workshop-test',
				etag: 'etag-40',
				template: {},
			}),
		).toThrow('match');
		expect(() =>
			prepareCandidate('santas-workshop-test', legacyDocument(), {
				projectId: 'santas-workshop-test',
				etag: 'etag-40',
				template: template(),
			}),
		).toThrow('already contains');
	});
	it.each([undefined, '', '*'])(
		'requires a specific migration ETag: %s',
		(etag) => {
			expect(() =>
				prepareCandidate('santas-workshop-test', legacyDocument(), {
					projectId: 'santas-workshop-test',
					etag,
					template: {},
				}),
			).toThrow('specific source Remote Config ETag');
		},
	);
	it('writes defaults only from a published snapshot for the selected project', () => {
		const directory = mkdtempSync(
			join(tmpdir(), 'santashop-remote-config-'),
		);
		const output = join(directory, 'defaults.ts');
		try {
			expect(() =>
				writeDefaults(
					'santas-workshop-193b5',
					{ projectId: 'santas-workshop-test', template: template() },
					output,
				),
			).toThrow('does not match');
			expect(
				writeDefaults(
					'santas-workshop-test',
					{ projectId: 'santas-workshop-test', template: template() },
					output,
				).version,
			).toBe('42');
			expect(readFileSync(output, 'utf8')).toContain(
				'santas-workshop-test Remote Config version 42',
			);
		} finally {
			rmSync(directory, { recursive: true });
		}
	});
});
