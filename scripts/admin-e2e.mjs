import { spawn } from 'node:child_process';

// Only the fixed demo suite gets this flag, never a deployment command.
const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env['ComSpec'] ?? 'cmd.exe') : 'pnpm';
const args = isWindows
	? ['/d', '/s', '/c', 'pnpm run e2e:test:admin:demo']
	: ['run', 'e2e:test:admin:demo'];
const child = spawn(command, args, {
	stdio: 'inherit',
	env: {
		...process.env,
		E2E_BASE_URL: 'http://localhost:4100',
		E2E_EMULATOR_PROJECT: 'demo-santashop',
		FUNCTIONS_EMULATOR_URL:
			'http://127.0.0.1:5001/demo-santashop/us-central1',
		E2E_AUTH_PORT: '9099',
		E2E_FIRESTORE_PORT: '8180',
		E2E_FUNCTIONS_PORT: '5001',
		E2E_STORAGE_PORT: '9199',
		SANTASHOP_SEND_EMAILS_FROM_EMULATOR: 'false',
		SANTASHOP_REGISTRATION_REVIEW_ENABLED: 'true',
		SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED: 'true',
	},
});
child.once('error', (error) => {
	console.error('Could not start the Admin E2E suite.', error);
	process.exitCode = 1;
});
child.once('exit', (code, signal) => {
	process.exitCode = signal ? 1 : (code ?? 1);
});
