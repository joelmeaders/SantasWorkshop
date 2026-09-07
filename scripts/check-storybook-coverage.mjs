import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apps = ['santashop-app', 'santashop-admin'];
const problems = [];
const rows = [];

function filesIn(directory) {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const fullPath = path.join(directory, entry.name);
			return entry.isDirectory() ? filesIn(fullPath) : [fullPath];
		});
}

function parse(file) {
	return ts.createSourceFile(
		file,
		fs.readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
	);
}

function visit(node, callback) {
	callback(node);
	ts.forEachChild(node, (child) => visit(child, callback));
}

function relative(file) {
	return path.relative(root, file).replaceAll('\\', '/');
}

function unwrap(node) {
	while (
		node &&
		(ts.isSatisfiesExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isParenthesizedExpression(node))
	)
		node = node.expression;
	return node;
}

function propertyOf(node, name, variables, seen = new Set()) {
	node = unwrap(node);
	if (!node || seen.has(node)) return undefined;
	seen.add(node);
	if (ts.isIdentifier(node))
		return propertyOf(variables.get(node.text), name, variables, seen);
	if (!ts.isObjectLiteralExpression(node)) return undefined;
	for (const property of [...node.properties].reverse()) {
		if (ts.isSpreadAssignment(property)) {
			const inherited = propertyOf(
				property.expression,
				name,
				variables,
				seen,
			);
			if (inherited) return inherited;
		} else if (property.name?.getText() === name) {
			return ts.isPropertyAssignment(property)
				? property.initializer
				: property;
		}
	}
	return undefined;
}

function isPlayFunction(node, variables, seen = new Set()) {
	node = unwrap(node);
	if (!node || seen.has(node)) return false;
	seen.add(node);
	if (ts.isIdentifier(node))
		return isPlayFunction(variables.get(node.text), variables, seen);
	return (
		ts.isArrowFunction(node) ||
		ts.isFunctionExpression(node) ||
		ts.isFunctionDeclaration(node) ||
		ts.isMethodDeclaration(node)
	);
}

for (const app of apps) {
	const files = filesIn(path.join(root, app, 'src')).filter((file) =>
		file.endsWith('.ts'),
	);
	const stories = files
		.filter((file) => file.endsWith('.stories.ts'))
		.map((file) => {
			const source = parse(file);
			const imports = new Map();
			const components = new Set();
			const exports = [];
			const variables = new Map();
			let metadata;
			for (const statement of source.statements) {
				if (ts.isFunctionDeclaration(statement) && statement.name)
					variables.set(statement.name.text, statement);
				if (
					ts.isExportAssignment(statement) &&
					!statement.isExportEquals
				)
					metadata = statement.expression;
				if (
					ts.isImportDeclaration(statement) &&
					ts.isStringLiteral(statement.moduleSpecifier)
				) {
					const bindings = statement.importClause?.namedBindings;
					if (bindings && ts.isNamedImports(bindings)) {
						for (const binding of bindings.elements) {
							imports.set(binding.name.text, {
								name: (binding.propertyName ?? binding.name)
									.text,
								file:
									path.resolve(
										path.dirname(file),
										statement.moduleSpecifier.text,
									) + '.ts',
							});
						}
					}
				}
				if (ts.isVariableStatement(statement)) {
					for (const declaration of statement.declarationList
						.declarations) {
						if (!ts.isIdentifier(declaration.name)) continue;
						variables.set(
							declaration.name.text,
							declaration.initializer,
						);
						if (
							statement.modifiers?.some(
								(modifier) =>
									modifier.kind ===
									ts.SyntaxKind.ExportKeyword,
							)
						)
							exports.push(declaration.name.text);
					}
				}
			}
			const component = propertyOf(metadata, 'component', variables);
			if (component && ts.isIdentifier(component))
				components.add(component.text);
			const untested = exports.filter(
				(name) =>
					!isPlayFunction(
						propertyOf(variables.get(name), 'play', variables) ??
							propertyOf(metadata, 'play', variables),
						variables,
					),
			);
			return { file, imports, components, exports, untested };
		});
	for (const file of files.filter(
		(entry) => !/\.(stories|spec)\.ts$/.test(entry),
	)) {
		const source = parse(file);
		visit(source, (node) => {
			if (
				!ts.isClassDeclaration(node) ||
				!node.name ||
				!ts.canHaveDecorators(node)
			)
				return;
			const isComponent = ts
				.getDecorators(node)
				?.some(
					(decorator) =>
						ts.isCallExpression(decorator.expression) &&
						decorator.expression.expression.getText(source) ===
							'Component',
				);
			if (!isComponent) return;
			const name = node.name.text;
			const matches = stories.filter((story) =>
				[...story.components].some((local) => {
					const imported = story.imports.get(local);
					return imported?.name === name && imported.file === file;
				}),
			);
			if (!matches.length)
				problems.push(
					`${relative(file)}: ${name} has no story using the component.`,
				);
			for (const story of matches) {
				if (!story.exports.length)
					problems.push(`${relative(story.file)}: no named stories.`);
				if (story.untested.length)
					problems.push(
						`${relative(story.file)}: stories without a play test: ${story.untested.join(', ')}.`,
					);
			}
			rows.push({ app, name, file, stories: matches });
		});
	}
}

if (process.argv.includes('--write')) {
	const lines = [
		'# Storybook UI inventory',
		'',
		'Generated with `pnpm run storybook:coverage -- --write` from Angular component declarations and story imports.',
		'This checks catalog coverage. The browser suite checks rendering, interactions, accessibility, and external requests.',
		'',
		'| App | Component or page | Source | Story states |',
		'| --- | --- | --- | --- |',
		...rows.map(
			(row) =>
				`| ${row.app === 'santashop-app' ? 'Registration' : 'Admin'} | ${row.name} | [Source](../${relative(row.file)}) | ${row.stories.map((story) => `[${story.exports.join(', ')}](../${relative(story.file)})`).join('; ') || 'MISSING'} |`,
		),
		'',
	];
	fs.writeFileSync(
		path.join(root, 'docs/storybook-inventory.md'),
		lines.join('\n'),
	);
}

for (const app of apps) {
	const components = rows.filter((row) => row.app === app);
	console.log(
		`${app}: ${components.filter((row) => row.stories.length).length}/${components.length} components represented; ${components.reduce((sum, row) => sum + row.stories.reduce((total, story) => total + story.exports.length, 0), 0)} named states.`,
	);
}
if (problems.length) {
	console.error(problems.join('\n'));
	process.exitCode = 1;
}
