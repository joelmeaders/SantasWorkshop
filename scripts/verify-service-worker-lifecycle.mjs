import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');

const parseArguments = (argumentsList) => {
	const values = new Map();
	for (const argument of argumentsList) {
		const separator = argument.indexOf('=');
		if (!argument.startsWith('--') || separator < 0) {
			throw new Error(`Expected --name=value. Received: ${argument}`);
		}
		values.set(argument.slice(2, separator), argument.slice(separator + 1));
	}
	return values;
};

const requireArgument = (argumentsMap, name, fallback) => {
	const value = argumentsMap.get(name) ?? fallback;
	if (!value) throw new Error(`Missing required argument: --${name}=...`);
	return value;
};

const toFilePath = (root, requestPath) => {
	const decodedPath = decodeURIComponent(requestPath.split('?')[0]);
	const relativePath =
		decodedPath === '/' ? 'index.html' : decodedPath.slice(1);
	const candidate = path.resolve(root, relativePath);
	const rootWithSeparator = `${path.resolve(root)}${path.sep}`;
	if (
		candidate !== path.resolve(root) &&
		!candidate.startsWith(rootWithSeparator)
	) {
		return undefined;
	}
	return candidate;
};

const isNavigationRequest = (request) => {
	const requestPath = new URL(request.url, 'http://localhost').pathname;
	return (
		request.method === 'GET' &&
		(request.headers.accept ?? '').includes('text/html') &&
		!path.extname(requestPath)
	);
};

const createStaticServer = async (versionOneRoot, versionTwoRoot) => {
	let activeVersion = 'one';
	const probeRequests = [];
	const roots = {
		one: path.resolve(versionOneRoot),
		two: path.resolve(versionTwoRoot),
	};

	const server = http.createServer((request, response) => {
		const requestUrl = new URL(request.url ?? '/', 'http://localhost');
		const requestPath = requestUrl.pathname;

		if (
			requestPath === '/api/sw-lifecycle-probe' ||
			requestPath === '/qr/sw-lifecycle-probe.png'
		) {
			probeRequests.push({ path: requestPath, version: activeVersion });
			const body = requestPath.endsWith('.png')
				? Buffer.from('not-a-real-qr')
				: 'api probe';
			response.writeHead(200, {
				'Cache-Control': 'no-store',
				'Content-Type': requestPath.endsWith('.png')
					? 'image/png'
					: 'text/plain',
				'X-SW-Lifecycle-Source': activeVersion,
			});
			response.end(body);
			return;
		}

		const root = roots[activeVersion];
		let filePath = toFilePath(root, requestPath);
		if (!filePath) {
			response.writeHead(400);
			response.end('Invalid path');
			return;
		}

		access(filePath)
			.then(() => serveFile(filePath, response, activeVersion))
			.catch(() => {
				if (!isNavigationRequest(request)) {
					response.writeHead(404);
					response.end('Not found');
					return;
				}
				filePath = path.join(root, 'index.html');
				serveFile(filePath, response, activeVersion).catch(() => {
					response.writeHead(500);
					response.end('Missing index.html');
				});
			});
	});

	const serveFile = async (filePath, response, version) => {
		const fileName = path.basename(filePath);
		const isWorkerMetadata =
			fileName === 'ngsw.json' || fileName === 'ngsw-worker.js';
		response.writeHead(200, {
			'Cache-Control': isWorkerMetadata
				? 'no-cache, no-store, must-revalidate'
				: 'public, max-age=31536000, immutable',
			'Content-Type': contentType(fileName),
		});
		createReadStream(filePath).pipe(response);
	};

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.equal(typeof address, 'object');

	return {
		baseUrl: `http://127.0.0.1:${address.port}`,
		probeRequests,
		switchVersion(version) {
			assert.ok(version === 'one' || version === 'two');
			activeVersion = version;
		},
		close: () =>
			new Promise((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			),
	};
};

const contentType = (fileName) => {
	if (fileName.endsWith('.html')) return 'text/html; charset=utf-8';
	if (fileName.endsWith('.js')) return 'text/javascript; charset=utf-8';
	if (fileName.endsWith('.css')) return 'text/css; charset=utf-8';
	if (fileName.endsWith('.json')) return 'application/json; charset=utf-8';
	return 'application/octet-stream';
};

const readManifest = async (root) => {
	const manifest = JSON.parse(
		await readFile(path.join(root, 'ngsw.json'), 'utf8'),
	);
	assert.ok(
		manifest.hashTable,
		`${root} does not contain an Angular service-worker hash table`,
	);
	return manifest;
};

const main = async () => {
	const argumentsMap = parseArguments(process.argv.slice(2));
	const application = argumentsMap.get('app') ?? 'customer';
	assert.ok(
		application === 'customer' || application === 'admin',
		'--app must be customer or admin',
	);
	const versionOneRoot = path.resolve(
		workspaceRoot,
		requireArgument(argumentsMap, 'version-one'),
	);
	const versionTwoRoot = path.resolve(
		workspaceRoot,
		requireArgument(argumentsMap, 'version-two'),
	);
	const manifestOne = await readManifest(versionOneRoot);
	const manifestTwo = await readManifest(versionTwoRoot);
	assert.notDeepEqual(
		manifestOne.hashTable,
		manifestTwo.hashTable,
		'The two supplied builds have identical service-worker assets',
	);

	const server = await createStaticServer(versionOneRoot, versionTwoRoot);
	const browser = await chromium.launch({ headless: true });
	const contexts = [];

	try {
		const selectors =
			application === 'admin'
				? {
						path: '/',
						email: '#adminSignInEmail input',
						password: '#adminSignInPassword input',
					}
				: {
						path: '/?mode=sign-in',
						email: '#signInEmail input',
						password: '#signInPassword input',
					};
		const createContext = async () => {
			const context = await browser.newContext({
				serviceWorkers: 'allow',
			});
			contexts.push(context);
			await context.route('**/*', async (route) => {
				if (!route.request().url().startsWith(server.baseUrl)) {
					await route.abort();
					return;
				}
				await route.continue();
			});
			return context;
		};

		const laterContext = await createContext();
		const reloadContext = await createContext();
		const laterPage = await laterContext.newPage();
		const reloadPage = await reloadContext.newPage();
		const openInitialPage = async (page) => {
			await page.goto(`${server.baseUrl}${selectors.path}`, {
				waitUntil: 'domcontentloaded',
			});
			await page.locator(selectors.email).waitFor();
			await page.evaluate(async () => {
				const registration = await navigator.serviceWorker.ready;
				if (!registration.active)
					throw new Error(
						'Angular service worker did not become active',
					);
			});
			if (
				!(await page.evaluate(() =>
					Boolean(navigator.serviceWorker.controller),
				))
			) {
				await page.reload({ waitUntil: 'domcontentloaded' });
				await page.locator(selectors.email).waitFor();
			}
			assert.equal(
				await page.evaluate(() =>
					Boolean(navigator.serviceWorker.controller),
				),
				true,
				'The initial page was not controlled by the Angular service worker',
			);
			return page.locator('script[src*="main-"]').getAttribute('src');
		};

		const [laterMain, reloadMain] = await Promise.all([
			openInitialPage(laterPage),
			openInitialPage(reloadPage),
		]);
		assert.ok(
			laterMain && reloadMain,
			'The initial pages did not load a hashed main bundle',
		);
		const laterEmail = laterPage.locator(selectors.email);
		const laterPassword = laterPage.locator(selectors.password);
		await laterEmail.fill('state-preservation@example.test');
		await laterPassword.fill('state-value-123');
		await Promise.all([
			laterPage.waitForTimeout(2000),
			reloadPage.waitForTimeout(2000),
		]);

		const initialProbe = await laterPage.evaluate(async () => {
			const responses = await Promise.all([
				fetch('/api/sw-lifecycle-probe'),
				fetch('/qr/sw-lifecycle-probe.png'),
			]);
			return responses.map((response) => ({
				status: response.status,
				source: response.headers.get('X-SW-Lifecycle-Source'),
			}));
		});
		assert.deepEqual(
			initialProbe.map(({ status }) => status),
			[200, 200],
		);
		assert.deepEqual(
			initialProbe.map(({ source }) => source),
			['one', 'one'],
		);

		server.switchVersion('two');
		await Promise.all(
			[laterPage, reloadPage].map((page) =>
				page.evaluate(async () => {
					const controller = navigator.serviceWorker.controller;
					if (!controller)
						throw new Error(
							'The page has no active Angular service-worker controller',
						);
					const nonce = Math.round(Math.random() * 10_000_000);
					return await new Promise((resolve, reject) => {
						const onMessage = (event) => {
							if (
								event.data?.type !== 'OPERATION_COMPLETED' ||
								event.data.nonce !== nonce
							)
								return;
							navigator.serviceWorker.removeEventListener(
								'message',
								onMessage,
							);
							if (event.data.error)
								reject(new Error(event.data.error));
							else resolve(event.data.result);
						};
						navigator.serviceWorker.addEventListener(
							'message',
							onMessage,
						);
						controller.postMessage({
							action: 'CHECK_FOR_UPDATES',
							nonce,
						});
					});
				}),
			),
		);

		const readyPrompt = (page) =>
			page
				.locator('.app-update-prompt')
				.filter({ hasText: 'A fresh update is ready' });
		await Promise.all([
			readyPrompt(laterPage).waitFor(),
			readyPrompt(reloadPage).waitFor(),
		]);

		await laterPage
			.getByRole('button', { name: 'Not now', exact: true })
			.click();
		assert.equal(
			await laterEmail.inputValue(),
			'state-preservation@example.test',
		);
		assert.equal(await laterPassword.inputValue(), 'state-value-123');

		await laterPage.reload({ waitUntil: 'domcontentloaded' });
		await laterPage.locator(selectors.email).waitFor();
		const laterMainAfterRefresh = await laterPage
			.locator('script[src*="main-"]')
			.getAttribute('src');
		assert.notEqual(
			laterMainAfterRefresh,
			laterMain,
			'Manual refresh did not load the ready version',
		);

		await reloadPage
			.getByRole('button', { name: 'Refresh page', exact: true })
			.click();
		await reloadPage.waitForLoadState('domcontentloaded');
		await reloadPage.locator(selectors.email).waitFor();
		const reloadMainAfterExplicitReload = await reloadPage
			.locator('script[src*="main-"]')
			.getAttribute('src');
		assert.notEqual(
			reloadMainAfterExplicitReload,
			reloadMain,
			'Explicit Reload did not load the ready version',
		);

		const finalProbe = await laterPage.evaluate(async () => {
			const responses = await Promise.all([
				fetch('/api/sw-lifecycle-probe'),
				fetch('/qr/sw-lifecycle-probe.png'),
			]);
			return responses.map((response) => ({
				status: response.status,
				source: response.headers.get('X-SW-Lifecycle-Source'),
			}));
		});
		assert.deepEqual(
			finalProbe.map(({ status }) => status),
			[200, 200],
		);
		assert.deepEqual(
			finalProbe.map(({ source }) => source),
			['two', 'two'],
		);

		const cachedUrls = await laterPage.evaluate(async () => {
			const names = await caches.keys();
			const entries = [];
			for (const name of names) {
				const cache = await caches.open(name);
				entries.push(
					...(await cache.keys()).map((request) => request.url),
				);
			}
			return entries;
		});
		assert.equal(
			cachedUrls.some((url) =>
				/\/(?:api|qr)(?:\/|$)/i.test(new URL(url).pathname),
			),
			false,
			`The service worker cached an API or QR URL: ${cachedUrls.join(', ')}`,
		);
		assert.ok(
			server.probeRequests.filter(({ path: requestPath }) =>
				requestPath.startsWith('/api/'),
			).length >= 2,
			'No API probe reached the local server after service-worker registration',
		);
		assert.ok(
			server.probeRequests.filter(({ path: requestPath }) =>
				requestPath.startsWith('/qr/'),
			).length >= 2,
			'No QR probe reached the local server after service-worker registration',
		);

		console.log(
			`${application} service-worker lifecycle passed: registration, VERSION_READY, Later state preservation, manual refresh, explicit Reload, and no API/QR caching.`,
		);
	} finally {
		await Promise.all(contexts.map((context) => context.close()));
		await browser.close();
		await server.close();
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
