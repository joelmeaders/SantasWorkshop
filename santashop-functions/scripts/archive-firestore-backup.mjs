import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
	args.set(process.argv[index], process.argv[index + 1]);
}

const projectId = args.get('--project');
const confirmation = args.get('--confirm-project');
const backupLocation = args.get('--backup');
const destination = args.get('--destination');

if (!projectId || confirmation !== projectId) {
	throw new Error(
		'Provide matching --project and --confirm-project values.',
	);
}
if (!backupLocation?.startsWith('gs://')) {
	throw new Error('--backup must be the gs:// location recorded by the reset.');
}
if (!destination) {
	throw new Error('--destination must be an existing local directory.');
}

const result = spawnSync(
	process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
	[
		'storage',
		'cp',
		'--recursive',
		backupLocation,
		resolve(destination),
		`--project=${projectId}`,
	],
	{ stdio: 'inherit' },
);

if (result.error) {
	throw result.error;
}
if (result.status !== 0) {
	throw new Error(`gcloud storage copy exited with code ${result.status}.`);
}
