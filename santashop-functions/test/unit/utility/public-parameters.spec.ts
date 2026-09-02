import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const parameters = requireFromTest(
	'../../../../scripts/verify-public-parameters.cjs',
) as {
	verifyPublicParameters: (document: unknown) => {
		publicFields: number;
		adminFields: number;
	};
};

const booleanField = (value: boolean): { booleanValue: boolean } => ({
	booleanValue: value,
});

const validDocument = (): object => ({
	fields: {
		createAccountEnabled: booleanField(true),
		maintenanceModeEnabled: booleanField(false),
		registrationEnabled: booleanField(true),
		weatherModeEnabled: booleanField(false),
		admin: {
			mapValue: {
				fields: {
					allowCancelRegistration: booleanField(true),
					allowChangeRegistration: booleanField(true),
					checkinEnabled: booleanField(true),
					onsiteRegistrationEnabled: booleanField(true),
					preRegistrationEnabled: booleanField(true),
				},
			},
		},
	},
});

describe('public parameters deployment verification', () => {
	it('accepts a complete set of explicit boolean feature flags', () => {
		expect(parameters.verifyPublicParameters(validDocument())).toEqual({
			publicFields: 4,
			adminFields: 5,
		});
	});

	it('rejects a missing admin feature flag', () => {
		const document = validDocument() as {
			fields: { admin: { mapValue: { fields: Record<string, unknown> } } };
		};
		delete document.fields.admin.mapValue.fields['preRegistrationEnabled'];

		expect(() => parameters.verifyPublicParameters(document)).toThrow(
			'admin.preRegistrationEnabled must be an explicit boolean',
		);
	});

	it('rejects a non-boolean public feature flag', () => {
		const document = validDocument() as {
			fields: Record<string, unknown>;
		};
		document.fields['registrationEnabled'] = { stringValue: 'true' };

		expect(() => parameters.verifyPublicParameters(document)).toThrow(
			'registrationEnabled must be an explicit boolean',
		);
	});
});
