import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
import admin from '../firebase-admin';
import {
	parsePublicParameters,
	type PublicParameters,
} from '../models';
import { createFunctionLogger } from './observability';
import { settingsFromTemplate, withPublicParametersDeadline } from './public-parameters';

const REMOTE_CONFIG_API = 'https://firebaseremoteconfig.googleapis.com/v1/projects';
const FRESH_FOR_MS = 10_000;
const log = createFunctionLogger('publicParametersGateway');

export interface PublicParametersGatewayResponse {
	settings: PublicParameters;
	source: 'fresh' | 'stale';
	lastFreshAt: number;
}

const projectId = (): string => {
	const configured = admin.app().options.projectId ?? process.env['GCLOUD_PROJECT'] ?? process.env['GCP_PROJECT'];
	if (!configured) throw new Error('A Firebase project ID is required for the public settings gateway.');
	return configured;
};

const accessToken = async (): Promise<string> => {
	const credential = admin.app().options.credential;
	if (!credential) throw new Error('A Google credential is required for the public settings gateway.');
	const token = await credential.getAccessToken();
	if (!token.access_token) throw new Error('A Google access token is required for the public settings gateway.');
	return token.access_token;
};

/** Read one Remote Config template without the Admin SDK retry loop. */
export const fetchRemoteConfigSettings = async (
	fetcher: typeof fetch = fetch,
): Promise<PublicParameters> => {
	const signal = AbortSignal.timeout(10_000);
	const response = await fetcher(
		`${REMOTE_CONFIG_API}/${encodeURIComponent(projectId())}/remoteConfig`,
		{
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${await accessToken()}`,
			},
			redirect: 'error',
			signal,
		},
	);
	if (!response.ok) throw new Error(`Remote Config request failed with status ${response.status}.`);
	return settingsFromTemplate((await response.json()) as RemoteConfigTemplate);
};

/** Keep one validated value per gateway instance and coalesce concurrent refreshes. */
export class PublicParametersGatewayCache {
	private current?: PublicParameters;
	private lastFreshAt?: number;
	private nextAttempt = 0;
	private failures = 0;
	private pending?: Promise<PublicParametersGatewayResponse>;

	constructor(
		private readonly fetchSettings: () => Promise<PublicParameters> = fetchRemoteConfigSettings,
		private readonly now: () => number = Date.now,
	) {}

	public read(): Promise<PublicParametersGatewayResponse> {
		const current = this.current;
		if (current && this.now() < this.nextAttempt) {
			return Promise.resolve(this.response(this.failures === 0 ? 'fresh' : 'stale'));
		}
		if (this.pending) return this.pending;
		if (this.now() < this.nextAttempt) {
			if (current) return Promise.resolve(this.response('stale'));
			return Promise.reject(new Error('Public settings are not available.'));
		}

		const startedAt = this.now();
		this.pending = withPublicParametersDeadline(
			Promise.resolve().then(() => this.fetchSettings()),
		)
			.then((value) => {
				this.current = parsePublicParameters(value);
				this.lastFreshAt = this.now();
				this.failures = 0;
				this.nextAttempt = this.lastFreshAt + FRESH_FOR_MS;
				log.info('Public settings gateway refresh succeeded.', {
					source: 'fresh',
					lastFreshAt: this.lastFreshAt,
					durationMs: Math.max(0, this.now() - startedAt),
				});
				return this.response('fresh');
			})
			.catch((error: unknown) => {
				this.nextAttempt = this.now() + this.retryDelay();
				log.warn('Public settings gateway refresh failed.', {
					source: this.current ? 'stale' : 'unavailable',
					durationMs: Math.max(0, this.now() - startedAt),
				});
				if (this.current) return this.response('stale');
				throw error;
			})
			.finally(() => {
				this.pending = undefined;
			});
		return this.pending;
	}

	private retryDelay(): number {
		const delays = [10_000, 30_000, 60_000, 300_000] as const;
		return delays[Math.min(this.failures++, delays.length - 1)] ?? 300_000;
	}

	private response(source: 'fresh' | 'stale'): PublicParametersGatewayResponse {
		if (!this.current || this.lastFreshAt === undefined) throw new Error('Public settings are not available.');
		return {
			settings: parsePublicParameters(this.current),
			source,
			lastFreshAt: this.lastFreshAt,
		};
	}
}

export const publicParametersGatewayCache = new PublicParametersGatewayCache();
