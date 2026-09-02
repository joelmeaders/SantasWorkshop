const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_PUBLIC_BOOLEAN_FIELDS = [
	'createAccountEnabled',
	'maintenanceModeEnabled',
	'registrationEnabled',
	'weatherModeEnabled',
];

const REQUIRED_ADMIN_BOOLEAN_FIELDS = [
	'allowCancelRegistration',
	'allowChangeRegistration',
	'checkinEnabled',
	'onsiteRegistrationEnabled',
	'preRegistrationEnabled',
];

const requireBooleanField = (fields, fieldName, prefix = '') => {
	const value = fields?.[fieldName]?.booleanValue;
	if (typeof value !== 'boolean') {
		throw new Error(
			`parameters/public field ${prefix}${fieldName} must be an explicit boolean.`,
		);
	}
	return value;
};

const verifyPublicParameters = (document) => {
	const fields = document?.fields;
	if (!fields || typeof fields !== 'object') {
		throw new Error('Firestore response did not contain parameters/public fields.');
	}

	for (const fieldName of REQUIRED_PUBLIC_BOOLEAN_FIELDS) {
		requireBooleanField(fields, fieldName);
	}

	const adminFields = fields.admin?.mapValue?.fields;
	if (!adminFields || typeof adminFields !== 'object') {
		throw new Error('parameters/public field admin must be a map.');
	}
	for (const fieldName of REQUIRED_ADMIN_BOOLEAN_FIELDS) {
		requireBooleanField(adminFields, fieldName, 'admin.');
	}

	return {
		publicFields: REQUIRED_PUBLIC_BOOLEAN_FIELDS.length,
		adminFields: REQUIRED_ADMIN_BOOLEAN_FIELDS.length,
	};
};

const main = () => {
	const documentPath = process.argv[2];
	if (!documentPath) {
		throw new Error(
			'Usage: node scripts/verify-public-parameters.cjs <firestore-document.json>',
		);
	}

	const document = JSON.parse(
		fs.readFileSync(path.resolve(documentPath), 'utf8'),
	);
	const result = verifyPublicParameters(document);
	console.log(
		`Verified parameters/public with ${result.publicFields} public and ${result.adminFields} admin boolean flags.`,
	);
};

module.exports = {
	REQUIRED_ADMIN_BOOLEAN_FIELDS,
	REQUIRED_PUBLIC_BOOLEAN_FIELDS,
	verifyPublicParameters,
};

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
