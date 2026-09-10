import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const executeFile = promisify(execFile);
import { PROJECT, assertProject } from './config.mjs';

const ALLOWED_APIS = new Set([
	'cloudfunctions.googleapis.com',
	'run.googleapis.com',
	'compute.googleapis.com',
	'vpcaccess.googleapis.com',
	'dns.googleapis.com',
	'serviceusage.googleapis.com',
	'firestore.googleapis.com',
	'monitoring.googleapis.com',
	'cloudscheduler.googleapis.com',
	'cloudtasks.googleapis.com',
	'eventarc.googleapis.com',
	'firebase.googleapis.com',
	'identitytoolkit.googleapis.com',
	'firebaseappcheck.googleapis.com',
	'firebasehosting.googleapis.com',
	'firebaseremoteconfig.googleapis.com',
	'cloudbilling.googleapis.com',
	'iamcredentials.googleapis.com',
	'logging.googleapis.com',
	'storage.googleapis.com',
]);

export class GoogleClient {
	#credentials = new Map();
	constructor(project) {
		assertProject(project);
		this.project = project;
	}
	async #credential(kind) {
		let cached = this.#credentials.get(kind);
		if (!cached || Date.now() >= cached.expires) {
			const command =
				kind === 'identity'
					? 'print-identity-token'
					: 'print-access-token';
			const pending = (async () => {
				try {
					const { stdout } = await executeFile(
						process.platform === 'win32'
							? 'powershell.exe'
							: 'gcloud',
						process.platform === 'win32'
							? [
									'-NoProfile',
									'-Command',
									`gcloud auth ${command}`,
								]
							: ['auth', command],
						{
							encoding: 'utf8',
							windowsHide: true,
							timeout: 30_000,
						},
					);
					return stdout.trim();
				} catch {
					throw new Error(
						'Google credential retrieval failed. Check the current gcloud sign-in.',
					);
				}
			})();
			cached = { pending, expires: Date.now() + 45 * 60_000 };
			this.#credentials.set(kind, cached);
			void pending.catch(() => this.#credentials.delete(kind));
		}
		return cached.pending;
	}
	identityToken() {
		return this.#credential('identity');
	}
	token() {
		return this.#credential('access');
	}
	async request(url, { method = 'GET', body, allow404 = false } = {}) {
		assertProject(this.project);
		const parsed = new URL(url);
		// Compute operation self-links use this legacy Google API hostname.
		if (
			parsed.hostname === 'www.googleapis.com' &&
			parsed.pathname.startsWith('/compute/v1/')
		) {
			parsed.hostname = 'compute.googleapis.com';
			url = parsed.href;
		}
		if (parsed.protocol !== 'https:' || !ALLOWED_APIS.has(parsed.hostname))
			throw new Error('Unapproved Google API target.');
		if (url.includes('santas-workshop-193b5'))
			throw new Error(
				'Production access is forbidden in the load harness.',
			);
		const response = await fetch(url, {
			method,
			redirect: 'error',
			signal: AbortSignal.timeout(60_000),
			headers: {
				Authorization: `Bearer ${await this.token()}`,
				'X-Goog-User-Project': PROJECT,
				'Content-Type': 'application/json',
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		if (allow404 && response.status === 404) return undefined;
		if (response.status === 204 && method === 'DELETE') return {};
		const data = await response.json().catch(() => {
			throw new Error(
				`${method} ${parsed.hostname}${parsed.pathname}: HTTP ${response.status}, non-JSON response.`,
			);
		});
		if (!response.ok)
			throw new Error(
				`${method} ${parsed.hostname}${parsed.pathname}: ${data.error?.status ?? response.status}: ${data.error?.message ?? 'Google API request failed'}`,
			);
		return data;
	}
	async list(url, key) {
		const items = [];
		let next;
		do {
			const pageUrl = new URL(url);
			if (next) pageUrl.searchParams.set('pageToken', next);
			const page = await this.request(pageUrl.href);
			if (page.unreachable?.length)
				throw new Error(
					`Inventory has unreachable locations: ${pageUrl.hostname}${pageUrl.pathname}.`,
				);
			items.push(...(page[key] ?? []));
			next = page.nextPageToken;
		} while (next);
		return items;
	}
}

export const firestoreBase = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
export const decode = (value) => {
	if ('timestampValue' in value) return value.timestampValue;
	if ('integerValue' in value) return Number(value.integerValue);
	if ('doubleValue' in value) return value.doubleValue;
	if ('stringValue' in value) return value.stringValue;
	if ('booleanValue' in value) return value.booleanValue;
	if ('nullValue' in value) return null;
	if ('arrayValue' in value)
		return (value.arrayValue.values ?? []).map(decode);
	if ('mapValue' in value) return decodeFields(value.mapValue.fields);
	throw new Error('Unsupported Firestore value.');
};
export const decodeFields = (fields = {}) =>
	Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [key, decode(value)]),
	);
export const encode = (value) => {
	if (value instanceof Date) return { timestampValue: value.toISOString() };
	if (value === null) return { nullValue: null };
	if (typeof value === 'string') return { stringValue: value };
	if (typeof value === 'boolean') return { booleanValue: value };
	if (typeof value === 'number')
		return Number.isInteger(value)
			? { integerValue: String(value) }
			: { doubleValue: value };
	if (Array.isArray(value))
		return { arrayValue: { values: value.map(encode) } };
	return { mapValue: { fields: encodeFields(value) } };
};
export const encodeFields = (value) =>
	Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, encode(item)]),
	);

export async function query(client, collection, filters = []) {
	const data = await client.request(`${firestoreBase}:runQuery`, {
		method: 'POST',
		body: {
			structuredQuery: {
				from: [{ collectionId: collection }],
				...(filters.length
					? {
							where: {
								compositeFilter: {
									op: 'AND',
									filters: filters.map(
										([field, op, value]) => ({
											fieldFilter: {
												field: { fieldPath: field },
												op,
												value: encode(value),
											},
										}),
									),
								},
							},
						}
					: {}),
			},
		},
	});
	return data
		.filter((item) => item.document)
		.map(({ document }) => ({
			id: document.name.split('/').at(-1),
			...decodeFields(document.fields),
		}));
}
