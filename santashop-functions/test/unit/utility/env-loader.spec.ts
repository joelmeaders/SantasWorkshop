import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type EnvironmentMap = Record<string, string | undefined>;

const requireFromTest = createRequire(import.meta.url);
const envLoader = requireFromTest('../../../../scripts/env-loader.cjs') as {
	loadEnvFile: (filePath: string, env?: EnvironmentMap) => void;
	loadEnvFiles: (filePaths: string[], env?: EnvironmentMap) => void;
	unquote: (value: string) => string;
};

const tempDirectories: string[] = [];

const createTempDirectory = (): string => {
	const directoryPath = fs.mkdtempSync(
		path.join(os.tmpdir(), 'santashop-env-loader-'),
	);
	tempDirectories.push(directoryPath);
	return directoryPath;
};

afterEach(() => {
	for (const directoryPath of tempDirectories.splice(0)) {
		fs.rmSync(directoryPath, { recursive: true, force: true });
	}
});

describe('env-loader', () => {
	it('unquotes quoted values and leaves unquoted values alone', () => {
		expect(envLoader.unquote('"quoted"')).toBe('quoted');
		expect(envLoader.unquote("'single-quoted'")).toBe('single-quoted');
		expect(envLoader.unquote('plain')).toBe('plain');
	});

	it('loads values from an env file without overwriting existing env values', () => {
		const directoryPath = createTempDirectory();
		const envFilePath = path.join(directoryPath, '.env');
		fs.writeFileSync(
			envFilePath,
			[
				'# ignored comment',
				'EXISTING=file-value',
				'QUOTED="quoted value"',
				"SINGLE='single value'",
				'PLAIN=plain-value',
				'NOT_A_VAR line ignored',
			].join('\n'),
			'utf8',
		);

		const env: EnvironmentMap = { EXISTING: 'process-value' };

		envLoader.loadEnvFile(envFilePath, env);

		expect(env['EXISTING']).toBe('process-value');
		expect(env['QUOTED']).toBe('quoted value');
		expect(env['SINGLE']).toBe('single value');
		expect(env['PLAIN']).toBe('plain-value');
	});

	it('loads multiple env files in order so earlier files win for duplicate keys', () => {
		const directoryPath = createTempDirectory();
		const firstEnvPath = path.join(directoryPath, 'first.env');
		const secondEnvPath = path.join(directoryPath, 'second.env');
		fs.writeFileSync(
			firstEnvPath,
			'SHARED=first\nFIRST_ONLY=one\n',
			'utf8',
		);
		fs.writeFileSync(
			secondEnvPath,
			'SHARED=second\nSECOND_ONLY=two\n',
			'utf8',
		);

		const env: EnvironmentMap = {};

		envLoader.loadEnvFiles([firstEnvPath, secondEnvPath], env);

		expect(env['SHARED']).toBe('first');
		expect(env['FIRST_ONLY']).toBe('one');
		expect(env['SECOND_ONLY']).toBe('two');
	});
});
