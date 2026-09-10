import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewPath = 'docs/function-call-graph.review.json';
const lockPath = 'docs/function-call-graph.sources.json';
const mapPath = 'docs/function-call-map.md';
const sourceRoots = [
	'santashop-app',
	'santashop-admin',
	'santashop-core',
	'santashop-functions',
	'santashop-models',
];
const read = (path) =>
	readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const walk = (node, visit) => {
	visit(node);
	ts.forEachChild(node, (child) => walk(child, visit));
};
const parse = (path, source = read(path)) =>
	ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
const location = (file, node) =>
	`${file.fileName}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
const nameOf = (node) =>
	ts.isPropertyAccessExpression(node)
		? node.name.text
		: ts.isIdentifier(node)
			? node.text
			: '';

function sourceFiles(folder) {
	return readdirSync(join(root, folder), { withFileTypes: true })
		.flatMap((entry) => {
			const path = `${folder}/${entry.name}`;
			return entry.isDirectory()
				? sourceFiles(path)
				: /\.(?:ts|js|mjs|cjs)$/.test(path) &&
					  !/(?:\.spec|\.test|\.stories|\.d)\.ts$|(?:^|\/)(?:test-helpers\.[jt]s|firebase\.config\.ts)$/.test(
							path,
					  )
					? [path]
					: [];
		})
		.sort();
}

export function sourceChanges(previous, current) {
	return [...new Set([...Object.keys(previous), ...Object.keys(current)])]
		.sort()
		.filter((path) => previous[path] !== current[path]);
}

export function cyclicComponents(edges) {
	const adjacency = new Map();
	for (const { from, to } of edges) {
		if (!adjacency.has(from)) adjacency.set(from, new Set());
		if (!adjacency.has(to)) adjacency.set(to, new Set());
		adjacency.get(from).add(to);
	}
	let index = 0;
	const indices = new Map(),
		low = new Map(),
		active = new Set(),
		stack = [],
		result = [];
	function visit(node) {
		indices.set(node, index);
		low.set(node, index++);
		stack.push(node);
		active.add(node);
		for (const next of adjacency.get(node)) {
			if (!indices.has(next)) {
				visit(next);
				low.set(node, Math.min(low.get(node), low.get(next)));
			} else if (active.has(next))
				low.set(node, Math.min(low.get(node), indices.get(next)));
		}
		if (low.get(node) === indices.get(node)) {
			const component = [];
			let next;
			do {
				next = stack.pop();
				active.delete(next);
				component.push(next);
			} while (next !== node);
			if (component.length > 1 || adjacency.get(node).has(node))
				result.push(component.sort());
		}
	}
	for (const node of [...adjacency.keys()].sort())
		if (!indices.has(node)) visit(node);
	return result.sort((a, b) => a.join().localeCompare(b.join()));
}

// Compare the exact edges inside each cyclic component, not only its nodes.
// Adding a new route to an existing cycle must also fail the baseline gate.
export function cycleSignatures(edges) {
	return cyclicComponents(edges)
		.map((nodes) =>
			edges
				.filter(
					(edge) =>
						nodes.includes(edge.from) && nodes.includes(edge.to),
				)
				.map(({ from, to, kind }) => `${from} --${kind}--> ${to}`)
				.sort()
				.join('\n'),
		)
		.sort();
}

export function entryPoints(file) {
	const entries = [];
	for (const statement of file.statements) {
		if (
			!ts.isVariableStatement(statement) ||
			!statement.modifiers?.some(
				(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
			)
		)
			continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer)
				throw new Error(
					`Unsupported export at ${location(file, declaration)}`,
				);
			const triggers = [];
			walk(declaration.initializer, (node) => {
				if (
					ts.isCallExpression(node) &&
					/^(onCall|onRequest|onDocument\w+|onSchedule|onTaskDispatched)$/.test(
						nameOf(node.expression),
					)
				)
					triggers.push(node);
			});
			if (triggers.length !== 1)
				throw new Error(
					`Expected one trigger for ${declaration.name.text}; review the parser.`,
				);
			const trigger = triggers[0];
			const properties = new Map();
			if (
				trigger.arguments[0] &&
				ts.isObjectLiteralExpression(trigger.arguments[0])
			) {
				for (const property of trigger.arguments[0].properties)
					if (ts.isPropertyAssignment(property))
						properties.set(
							property.name.getText(file),
							property.initializer
								.getText(file)
								.replace(/^['"]|['"]$/g, ''),
						);
			}
			const handlers = [];
			walk(trigger, (node) => {
				if (
					ts.isCallExpression(node) &&
					node.expression.kind === ts.SyntaxKind.ImportKeyword &&
					ts.isStringLiteral(node.arguments[0])
				)
					handlers.push(
						posix.normalize(
							posix.join(
								posix.dirname(file.fileName),
								node.arguments[0].text,
							),
						) + '.ts',
					);
			});
			if (declaration.name.text === 'publicParametersGateway')
				handlers.push(
					'santashop-functions/src/fn/publicParametersGateway.ts',
				);
			entries.push({
				name: declaration.name.text,
				trigger: nameOf(trigger.expression),
				emulatorOnly:
					nameOf(
						declaration.initializer.expression ??
							declaration.initializer,
					) === 'emulatorOnly',
				source: location(file, declaration),
				handlers: [...new Set(handlers)],
				document: properties.get('document'),
				schedule: properties.get('schedule'),
				timeZone: properties.get('timeZone'),
			});
		}
	}
	return entries;
}

export function clientCalls(files) {
	const calls = [];
	const wrapper = files.find((file) =>
		file.fileName.endsWith('/_functions-wrapper.ts'),
	);
	const wrapperMethods = new Map();
	if (wrapper)
		walk(wrapper, (node) => {
			if (!ts.isPropertyDeclaration(node) || !node.initializer) return;
			walk(node.initializer, (child) => {
				if (
					ts.isCallExpression(child) &&
					nameOf(child.expression) === 'callableWrapper' &&
					ts.isStringLiteral(child.arguments[0])
				)
					wrapperMethods.set(
						node.name.getText(wrapper),
						child.arguments[0].text,
					);
			});
		});
	for (const file of files) {
		const receivers = new Set();
		const aliases = new Map();
		walk(file, (node) => {
			if (ts.isImportSpecifier(node))
				aliases.set(
					node.name.text,
					node.propertyName?.text ?? node.name.text,
				);
			if (
				ts.isPropertyDeclaration(node) &&
				node.initializer &&
				ts.isCallExpression(node.initializer) &&
				nameOf(node.initializer.expression) === 'inject' &&
				node.initializer.arguments[0]?.getText(file) ===
					'FunctionsWrapper'
			)
				receivers.add(`this.${node.name.getText(file)}`);
		});
		walk(file, (node) => {
			if (!ts.isCallExpression(node)) return;
			const rawName = nameOf(node.expression);
			const name = aliases.get(rawName) ?? rawName;
			let target;
			if (name === 'callableWrapper' || name === 'httpsCallable') {
				const argument =
					node.arguments[name === 'httpsCallable' ? 1 : 0];
				// The one forwarding SDK adapter has its callers resolved above.
				if (
					file === wrapper &&
					name === 'httpsCallable' &&
					argument?.getText(file) === 'name'
				)
					return;
				if (!argument || !ts.isStringLiteralLike(argument))
					throw new Error(
						`Unresolved callable target at ${location(file, node)}. Extend the analysis before recording a review.`,
					);
				target = argument.text;
			} else if (
				ts.isPropertyAccessExpression(node.expression) &&
				receivers.has(node.expression.expression.getText(file))
			) {
				target = wrapperMethods.get(name);
				if (!target)
					throw new Error(
						`Unresolved FunctionsWrapper method at ${location(file, node)}`,
					);
			} else if (name === 'httpsCallableFromURL')
				throw new Error(
					`URL callable requires explicit analysis at ${location(file, node)}`,
				);
			if (target)
				calls.push({
					from: file.fileName.split('/')[0],
					to: target,
					source: location(file, node),
				});
		});
	}
	return calls.sort((a, b) =>
		`${a.from}/${a.to}/${a.source}`.localeCompare(
			`${b.from}/${b.to}/${b.source}`,
		),
	);
}

function link(source) {
	const match = /^(.*):(\d+)$/.exec(source);
	return match
		? `[${match[1]}:${match[2]}](../${match[1]}#L${match[2]})`
		: `[${source}](../${source})`;
}

function render(entries, calls, review, edges) {
	const lines = [
		'<!-- Generated by pnpm run functions:graph:update after source review. -->',
		'# Function call map',
		'',
		review.scope,
		'',
		'## Cycle findings',
		'',
		...review.findings.flatMap((finding) => [
			`### ${finding.title}`,
			'',
			finding.detail,
			'',
			`Evidence: ${finding.sources.map(link).join(', ')}.`,
			'',
		]),
		'## Runtime graph',
		'',
		'Solid edges below represent calls, queue dispatch, or Firestore document creation. An upsert edge is a possible creation if the document is missing. Read/listen edges are not calls and are excluded.',
		'',
		'```mermaid',
		'flowchart LR',
	];
	const nodes = [
		...new Set(edges.flatMap(({ from, to }) => [from, to])),
	].sort();
	const ids = new Map(nodes.map((node, index) => [node, `n${index}`]));
	for (const node of nodes) lines.push(`  ${ids.get(node)}["${node}"]`);
	for (const edge of edges)
		lines.push(
			`  ${ids.get(edge.from)} -->|"${edge.kind}"| ${ids.get(edge.to)}`,
		);
	lines.push('  classDef cycle fill:#fee2e2,stroke:#b91c1c,stroke-width:2px');
	for (const component of cyclicComponents(edges))
		lines.push(
			`  class ${component.map((node) => ids.get(node)).join(',')} cycle`,
		);
	lines.push(
		'```',
		'',
		'## App and shared-service calls',
		'',
		'These are callable construction sites and direct FunctionsWrapper method calls. Shared-core rows identify shared entry points; they do not assert that every shared method is used by both apps. The table includes emulator settings reads.',
		'',
		'| Caller package | Function | Source |',
		'| --- | --- | --- |',
	);
	for (const call of calls)
		lines.push(`| ${call.from} | ${call.to} | ${link(call.source)} |`);
	lines.push(
		'',
		'### App paths through shared AuthService',
		'',
		'| App | Function | Local helper chain | Evidence |',
		'| --- | --- | --- | --- |',
	);
	for (const route of review.clientPaths)
		lines.push(
			`| ${route.from} | ${route.to} | ${route.via} | ${route.sources.map(link).join('<br>')} |`,
		);
	lines.push(
		'',
		'## Function, Firestore, and task edges',
		'',
		'| From | To | Kind / condition | Evidence |',
		'| --- | --- | --- | --- |',
	);
	for (const edge of review.edges)
		lines.push(
			`| ${edge.from} | ${edge.to} | ${edge.kind}: ${edge.condition} | ${edge.sources.map(link).join('<br>')} |`,
		);
	for (const entry of entries.filter((entry) => entry.document))
		lines.push(
			`| firestore:${entry.document} | ${entry.name} | ${entry.trigger} | ${link(entry.source)} |`,
		);
	lines.push(
		'',
		'## Scheduled calls',
		'',
		'Cadence is supplied through required environment variables. Values below are repository configuration, not a live Cloud Scheduler inventory. All five use SHOP_TIME_ZONE / SANTASHOP_TIME_ZONE (America/Denver in the example and CI configuration).',
		'',
		'| Function | Schedule variable | Example schedule | PR CI test schedule | Handler |',
		'| --- | --- | --- | --- | --- |',
	);
	const example = read('.env.example'),
		workflow = read('.github/workflows/functions-pr-validation.yml');
	for (const entry of entries.filter((entry) => entry.schedule)) {
		const sample =
			example.match(
				new RegExp(`^PROD_${entry.schedule}=(.+)$`, 'm'),
			)?.[1] ?? 'not set';
		const test =
			workflow.match(
				new RegExp(`^  TEST_${entry.schedule}: (.+)$`, 'm'),
			)?.[1] ?? 'not set';
		lines.push(
			`| ${entry.name} | ${entry.schedule} | \`${sample}\` | \`${test.replace(/^'|'$/g, '')}\` | ${entry.handlers.map(link).join('<br>')} |`,
		);
	}
	lines.push(
		'',
		...review.notes.flatMap((note) => [note, '']),
		'## Complete exported function inventory',
		'',
		`${entries.filter((entry) => !entry.emulatorOnly).length} deployed-source functions and ${entries.filter((entry) => entry.emulatorOnly).length} emulator-only functions. A function with no outgoing edge still appears here. Handler modules are local implementation calls, not additional deployments.`,
		'',
		'| Function | Trigger | App callers | Handler module | Definition |',
		'| --- | --- | --- | --- | --- |',
	);
	for (const entry of entries)
		lines.push(
			`| ${entry.name} | ${entry.trigger}${entry.emulatorOnly ? ' (emulator only)' : ''} | ${[...new Set(calls.filter((call) => call.to === entry.name).map((call) => call.from))].join(', ') || 'No app call found'} | ${entry.handlers.map(link).join('<br>')} | ${link(entry.source)} |`,
		);
	lines.push(
		'',
		'## Keeping the check current',
		'',
		'- Run `pnpm run functions:cycles` for strict validation. It fails on every cycle, including the existing findings.',
		'- Run `pnpm run functions:graph:check` for the CI regression gate. It reports the existing findings and fails on new or changed cycles, unresolved callable targets, missing endpoints, changed source files, or a stale map. A passing regression gate does not mean the graph is acyclic.',
		'- Review changed source paths, including helper calls, Firestore create/set/update/delete operations, transactions, task continuations, HTTP targets, and browser subscriptions that issue writes. Update `docs/function-call-graph.review.json` with semantic edges and evidence.',
		'- Only after that review, run `pnpm run functions:graph:update` to record source hashes and regenerate this map. This command does not infer semantic edges, approve a cycle, change the known-cycle baseline, or fix application code.',
		'- Add a cycle to `knownCycles` only as an explicit, documented finding. Keep strict validation failing until the cycle is removed. Remove obsolete baseline entries when fixing cycles.',
		'',
		'## Analysis limits',
		'',
		'The TypeScript parser discovers exports, trigger configuration, and the current callable wrapper patterns. The reviewed graph supplies semantic runtime edges through helpers and Firestore writes. Source hashes cover non-test source in both apps, shared core/models, and Functions, plus routing, rules, and schedule configuration. Any change forces a new review; hashes are a review gate, not proof that a reviewer identified every edge. Tests, stories, declaration files, and ignored generated firebase.config.ts files are excluded. Exported emulator handlers and testHelpers.ts remain inventoried and hashed.',
		'',
		'This map is source evidence. It does not inspect deployed functions, external callers, Console-created triggers, live schedules, SDK internals, all JavaScript helper recursion, or every possible browser event sequence. Cloud retry/redelivery can repeat a handler without a new source-level edge. Runtime idempotency remains necessary.',
		'',
	);
	return lines.join('\n');
}

export function main(args = process.argv.slice(2)) {
	if (
		args.some((arg) => !['--update', '--strict'].includes(arg)) ||
		(args.includes('--update') && args.includes('--strict'))
	)
		throw new Error(
			'Usage: node scripts/function-call-graph.mjs [--update | --strict]',
		);
	const files = [
		...sourceRoots.flatMap((folder) => sourceFiles(`${folder}/src`)),
		...sourceFiles('scripts/load/functions'),
	];
	const coverage = [
		...files,
		'firebase.json',
		'firestore.rules',
		'.env.example',
		'config.functions.cjs',
		'scripts/load/configuration.cjs',
		'.github/workflows/functions-pr-validation.yml',
		'.github/workflows/functions-test-and-prod-release.yml',
	].sort();
	const hashes = Object.fromEntries(
		coverage.map((path) => [
			path,
			createHash('sha256').update(read(path)).digest('hex'),
		]),
	);
	const entries = entryPoints(parse('santashop-functions/src/index.ts'));
	const calls = clientCalls(
		files
			.filter(
				(path) =>
					!path.startsWith('santashop-functions/') &&
					!path.startsWith('santashop-models/'),
			)
			.map((path) => parse(path)),
	);
	const names = new Set(entries.map((entry) => entry.name));
	for (const call of calls)
		if (
			!entries.some(
				(entry) => entry.name === call.to && entry.trigger === 'onCall',
			)
		)
			throw new Error(
				`Unknown/non-callable target ${call.to} at ${call.source}`,
			);
	const review = JSON.parse(read(reviewPath));
	for (const route of review.clientPaths) {
		if (
			!['santashop-app', 'santashop-admin', 'santashop-core'].includes(
				route.from,
			) ||
			!entries.some(
				(entry) =>
					entry.name === route.to && entry.trigger === 'onCall',
			) ||
			!route.via ||
			!route.sources.length
		)
			throw new Error('Invalid reviewed client path.');
		for (const source of route.sources) {
			const match = /^(.*):(\d+)$/.exec(source);
			if (
				!match ||
				Number(match[2]) < 1 ||
				read(match[1]).split('\n').length < Number(match[2])
			)
				throw new Error(`Invalid client evidence: ${source}`);
		}
	}
	const firestoreNodes = entries
		.filter((entry) => entry.document)
		.map((entry) => `firestore:${entry.document}`);
	for (const edge of review.edges) {
		if (
			![...names, ...firestoreNodes].includes(edge.from) ||
			![...names, ...firestoreNodes].includes(edge.to)
		)
			throw new Error(
				`Unknown reviewed endpoint: ${edge.from} -> ${edge.to}`,
			);
		if (!edge.condition || !edge.sources?.length)
			throw new Error(
				'Every reviewed edge requires a condition and source evidence.',
			);
		for (const source of edge.sources) {
			const match = /^(.*):(\d+)$/.exec(source);
			if (
				!match ||
				Number(match[2]) < 1 ||
				read(match[1]).split('\n').length < Number(match[2])
			)
				throw new Error(`Invalid evidence: ${source}`);
		}
	}
	const edges = [
		...review.edges,
		...review.clientPaths.map(({ from, to }) => ({
			from,
			to,
			kind: 'via-shared-service',
		})),
		...entries
			.filter((entry) => entry.document)
			.map((entry) => ({
				from: `firestore:${entry.document}`,
				to: entry.name,
				kind: entry.trigger,
			})),
		...entries
			.filter((entry) => entry.schedule)
			.map((entry) => ({
				from: `schedule:${entry.schedule}`,
				to: entry.name,
				kind: 'schedule',
			})),
		...calls.map(({ from, to }) => ({ from, to, kind: 'callable' })),
	];
	const uniqueEdges = [
		...new Map(
			edges.map((edge) => [`${edge.from}/${edge.kind}/${edge.to}`, edge]),
		).values(),
	];
	const signatures = cycleSignatures(uniqueEdges);
	if (
		JSON.stringify(signatures) !==
		JSON.stringify([...review.knownCycles].sort())
	)
		throw new Error(
			`Cycle baseline changed. Review paths; do not auto-accept.\n${signatures.join('\n\n')}`,
		);
	const document = render(entries, calls, review, uniqueEdges);
	if (args.includes('--update')) {
		writeFileSync(join(root, lockPath), json(hashes));
		writeFileSync(join(root, mapPath), document);
	} else {
		const changed = sourceChanges(JSON.parse(read(lockPath)), hashes);
		if (changed.length)
			throw new Error(
				`Call graph source review is stale:\n${changed.join('\n')}\nReview the call paths before running functions:graph:update.`,
			);
		if (read(mapPath) !== document)
			throw new Error(
				'Generated call map is stale. Review and run functions:graph:update.',
			);
	}
	console.log(
		`${entries.length} exported functions; ${calls.length} client call sites; ${review.edges.length} reviewed runtime edges; ${signatures.length} cycle findings.`,
	);
	for (const signature of signatures)
		console.log(`KNOWN CYCLE (retained; see call map):\n${signature}`);
	if (args.includes('--strict') && signatures.length)
		throw new Error('Strict cycle check failed: the graph is not acyclic.');
	console.log(
		args.includes('--update')
			? 'Source review recorded and map generated.'
			: 'Source freshness and cycle regression checks passed (not an acyclic verdict).',
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
