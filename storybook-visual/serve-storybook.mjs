import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const storybookDirectory = path.resolve(
	scriptDirectory,
	'..',
	'dist',
	'storybook',
);
const hostname = process.env.STORYBOOK_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.STORYBOOK_PORT ?? '6007', 10);

const contentTypes = new Map([
	['.css', 'text/css; charset=utf-8'],
	['.gif', 'image/gif'],
	['.html', 'text/html; charset=utf-8'],
	['.ico', 'image/x-icon'],
	['.jpeg', 'image/jpeg'],
	['.jpg', 'image/jpeg'],
	['.js', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.map', 'application/json; charset=utf-8'],
	['.png', 'image/png'],
	['.svg', 'image/svg+xml'],
	['.woff', 'font/woff'],
	['.woff2', 'font/woff2'],
	['.webp', 'image/webp'],
]);

try {
	const storybookStats = await stat(storybookDirectory);
	if (!storybookStats.isDirectory()) throw new Error('not a directory');
} catch {
	process.stderr.write(
		`Missing ${storybookDirectory}. Build Storybook before starting the visual suite.\n`,
	);
	process.exit(1);
}

function safePath(requestURL) {
	let pathname;
	try {
		pathname = decodeURIComponent(
			new URL(requestURL, 'http://localhost').pathname,
		);
	} catch {
		return undefined;
	}
	const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
	const target = path.resolve(storybookDirectory, relativePath);
	if (
		target !== storybookDirectory &&
		!target.startsWith(`${storybookDirectory}${path.sep}`)
	) {
		return undefined;
	}
	return target;
}

const server = createServer(async (request, response) => {
	if (
		!request.url ||
		(request.method !== 'GET' && request.method !== 'HEAD')
	) {
		response.writeHead(405, {
			'content-type': 'text/plain; charset=utf-8',
		});
		response.end('Method not allowed');
		return;
	}

	const target = safePath(request.url);
	if (!target) {
		response.writeHead(400, {
			'content-type': 'text/plain; charset=utf-8',
		});
		response.end('Invalid path');
		return;
	}

	let file = target;
	try {
		const targetStats = await stat(file);
		if (targetStats.isDirectory()) {
			file = path.join(file, 'index.html');
		}
		await stat(file);
	} catch {
		response.writeHead(404, {
			'content-type': 'text/plain; charset=utf-8',
		});
		response.end('Not found');
		return;
	}

	const extension = path.extname(file).toLowerCase();
	response.writeHead(200, {
		'cache-control': 'no-store',
		'content-type':
			contentTypes.get(extension) ?? 'application/octet-stream',
	});
	if (request.method === 'HEAD') {
		response.end();
		return;
	}
	createReadStream(file)
		.on('error', () => {
			if (!response.headersSent) response.writeHead(500);
			response.end();
		})
		.pipe(response);
});

server.listen(port, hostname, () => {
	process.stdout.write(
		`Storybook static server listening on http://${hostname}:${port}\n`,
	);
});

function shutdown() {
	server.close(() => process.exit(0));
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
