const fs = require('node:fs');

const ENV_LINE_PATTERN = /^([A-Za-z_]\w*)=(.*)$/u;

const unquote = (value) => {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
};

const loadEnvFile = (filePath, env = process.env) => {
	if (!fs.existsSync(filePath)) {
		return;
	}

	const fileContents = fs.readFileSync(filePath, 'utf8');
	for (const rawLine of fileContents.split(/\r?\n/u)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const match = ENV_LINE_PATTERN.exec(line);
		if (!match) {
			continue;
		}

		const [, key, rawValue] = match;
		if (env[key] !== undefined) {
			continue;
		}

		env[key] = unquote(rawValue.trim());
	}
};

const loadEnvFiles = (filePaths, env = process.env) => {
	for (const filePath of new Set(filePaths)) {
		loadEnvFile(filePath, env);
	}
};

module.exports = {
	ENV_LINE_PATTERN,
	unquote,
	loadEnvFile,
	loadEnvFiles,
};
