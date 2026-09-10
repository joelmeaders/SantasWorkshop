import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import ts from 'typescript';
import {
	clientCalls,
	cyclicComponents,
	cycleSignatures,
	entryPoints,
	sourceChanges,
} from './function-call-graph.mjs';

const edge = (from, to, kind = 'call') => ({ from, to, kind });
const source = (path, text) =>
	ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);

test('shared sinks and diamond paths are acyclic', () => {
	assert.deepEqual(
		cyclicComponents([
			edge('app', 'a'),
			edge('app', 'b'),
			edge('a', 'mail'),
			edge('b', 'mail'),
		]),
		[],
	);
});

test('finds task self-dispatch and indirect Firestore feedback separately', () => {
	assert.deepEqual(
		cyclicComponents([
			edge('owner', 'owner'),
			edge('mail', 'queue'),
			edge('queue', 'mail'),
			edge('app', 'queue'),
		]),
		[['mail', 'queue'], ['owner']],
	);
});

test('finds a longer cycle hidden behind a shared downstream sink', () => {
	assert.deepEqual(
		cyclicComponents([
			edge('a', 'b'),
			edge('b', 'c'),
			edge('c', 'a'),
			edge('c', 'sink'),
			edge('independent', 'sink'),
		]),
		[['a', 'b', 'c']],
	);
});

test('a new edge inside an existing cycle changes the baseline signature', () => {
	const oldEdges = [
		edge('sender', 'queue', 'upsert'),
		edge('queue', 'sender', 'create-trigger'),
	];
	assert.notDeepEqual(
		cycleSignatures(oldEdges),
		cycleSignatures([
			...oldEdges,
			edge('queue', 'sender', 'update-trigger'),
		]),
	);
	assert.deepEqual(
		cycleSignatures(oldEdges),
		cycleSignatures([...oldEdges].reverse()),
	);
});

test('source review detects additions, deletions and edits', () => {
	assert.deepEqual(
		sourceChanges(
			{ removed: 'a', unchanged: 'b', edited: 'c' },
			{ added: 'a', unchanged: 'b', edited: 'd' },
		),
		['added', 'edited', 'removed'],
	);
});

test('inventory includes emulator wrappers, schedules and document triggers', () => {
	const entries = entryPoints(
		source(
			'index.ts',
			`
    export const local = emulatorOnly(() => onCall({}, () => {}));
    export const stats = onSchedule({schedule: SCHEDULE, timeZone: ZONE}, () => {});
    export const mail = onDocumentCreated({document: 'queue/{id}'}, () => {});
  `,
		),
	);
	assert.equal(entries[0].emulatorOnly, true);
	assert.equal(entries[1].schedule, 'SCHEDULE');
	assert.equal(entries[2].document, 'queue/{id}');
	assert.throws(
		() =>
			entryPoints(
				source(
					'index.ts',
					'export const hidden = someNewTrigger(() => {});',
				),
			),
		/Expected one trigger/,
	);
});

test('resolves load-only handlers outside the Functions source directory', () => {
	const entries = entryPoints(
		source(
			'santashop-functions/src/index.ts',
			`
		export const emailIsolationProbe = loadMode ? onRequest({}, async () => {
			return import('../../scripts/load/functions/emailIsolationProbe');
		}) : undefined;
	`,
		),
	);
	assert.deepEqual(entries[0].handlers, [
		'scripts/load/functions/emailIsolationProbe.ts',
	]);
});

test('resolves callable SDK aliases and injected wrapper methods without matching unrelated methods', () => {
	const wrapper = source(
		'santashop-core/src/_functions-wrapper.ts',
		`
    class FunctionsWrapper {
      callableWrapper = (name) => httpsCallable(this.functions, name);
      save = (data) => this.callableWrapper<Request, Response>('saveDraftChild')(data);
    }
  `,
	);
	const app = source(
		'santashop-app/src/service.ts',
		`
    import { httpsCallable as invoke } from 'firebase/functions';
    class Service {
      functions = inject(FunctionsWrapper);
      run() { this.functions.save({}); invoke(fn, 'newAccount')({}); other.save({}); }
    }
  `,
	);
	assert.deepEqual(
		clientCalls([wrapper, app])
			.map(({ to }) => to)
			.sort(),
		['newAccount', 'saveDraftChild', 'saveDraftChild'],
	);
});

test('dynamic client endpoints fail rather than silently disappearing', () => {
	assert.throws(
		() =>
			clientCalls([
				source('app.ts', 'httpsCallable(functions, name)({});'),
			]),
		/Unresolved callable target/,
	);
	assert.throws(
		() =>
			clientCalls([
				source('app.ts', 'httpsCallableFromURL(functions, url)({});'),
			]),
		/explicit analysis/,
	);
});

test('strict command reports the retained worker cycle and exits unsuccessfully', () => {
	const result = spawnSync(
		process.execPath,
		['scripts/function-call-graph.mjs', '--strict'],
		{ encoding: 'utf8', cwd: new URL('..', import.meta.url) },
	);
	assert.equal(result.status, 1);
	assert.match(
		result.stdout,
		/ownerOperationWorker --task-continuation--> ownerOperationWorker/,
	);
	assert.doesNotMatch(result.stdout, /upsert-if-missing/);
	assert.match(result.stderr, /graph is not acyclic/);
});
