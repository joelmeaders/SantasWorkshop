import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
import admin from '../firebase-admin';
import { createFunctionLogger } from './observability';

export const EMAIL_SENDING_PARAMETER = 'santashop_email_sending_enabled';
export const EMAIL_SETTING_CACHE_MS = 180_000;
const log = createFunctionLogger('emailSending');

/** A missing, conditional, or malformed control must never authorize a send. */
export const emailSendingFromTemplate = (
	template: RemoteConfigTemplate,
): boolean => {
	const parameters = [
		template.parameters?.[EMAIL_SENDING_PARAMETER],
		...Object.values(template.parameterGroups ?? {}).map(
			(group) => group.parameters?.[EMAIL_SENDING_PARAMETER],
		),
	].filter((parameter) => parameter !== undefined);
	const parameter = parameters[0];
	if (
		parameters.length !== 1 ||
		parameter?.valueType !== 'BOOLEAN' ||
		Object.keys(parameter.conditionalValues ?? {}).length ||
		!parameter.defaultValue ||
		!('value' in parameter.defaultValue) ||
		!['true', 'false'].includes(parameter.defaultValue.value)
	) {
		throw new Error(
			'Email sending requires one unconditional BOOLEAN Remote Config value.',
		);
	}
	return parameter.defaultValue.value === 'true';
};

export const fetchEmailSendingEnabled = async (
	fetcher: typeof fetch = fetch,
): Promise<boolean> => {
	if (process.env['FUNCTIONS_EMULATOR'] === 'true') {
		if (process.env['SANTASHOP_SEND_EMAILS_FROM_EMULATOR'] !== 'true')
			return false;
		if (!process.env['FIRESTORE_EMULATOR_HOST']) {
			throw new Error(
				'The email setting requires a verified Firestore emulator.',
			);
		}
		const snapshot = await admin
			.firestore()
			.doc('_testConfig/emailSending')
			.get();
		return snapshot.data()?.['enabled'] === true;
	}
	const app = admin.app();
	const project =
		app.options.projectId ??
		process.env['GCLOUD_PROJECT'] ??
		process.env['GCP_PROJECT'];
	if (!project || !app.options.credential)
		throw new Error(
			'Email settings require a project and runtime credential.',
		);
	const token = await app.options.credential.getAccessToken();
	const response = await fetcher(
		`https://firebaseremoteconfig.googleapis.com/v1/projects/${encodeURIComponent(project)}/remoteConfig`,
		{
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				Accept: 'application/json',
			},
			redirect: 'error',
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!response.ok)
		throw new Error(
			`Email setting request failed with status ${response.status}.`,
		);
	return emailSendingFromTemplate(
		(await response.json()) as RemoteConfigTemplate,
	);
};

/** Refresh before sending; expired permission is never reused after a failed read. */
export class EmailSendingCache {
	private enabled = false;
	private expiresAt = 0;
	private pending?: Promise<boolean>;

	constructor(
		private readonly fetchSetting: () => Promise<boolean> = fetchEmailSendingEnabled,
		private readonly now: () => number = Date.now,
	) {}

	public read(): Promise<boolean> {
		if (this.now() < this.expiresAt) return Promise.resolve(this.enabled);
		if (this.pending) return this.pending;
		const startedAt = this.now();
		let timer: ReturnType<typeof setTimeout> | undefined;
		this.pending = Promise.race([
			Promise.resolve().then(() => this.fetchSetting()),
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() => reject(new Error('Email setting request timed out.')),
					10_000,
				);
				timer.unref();
			}),
		])
			.then((enabled) => {
				if (typeof enabled !== 'boolean')
					throw new Error('Invalid email setting.');
				this.enabled = enabled;
				this.expiresAt = startedAt + EMAIL_SETTING_CACHE_MS;
				return this.enabled;
			})
			.catch(() => {
				this.enabled = false;
				this.expiresAt = startedAt + EMAIL_SETTING_CACHE_MS;
				log.warn(
					'Email sending blocked because the remote setting is unavailable.',
				);
				return false;
			})
			.finally(() => {
				if (timer) clearTimeout(timer);
				this.pending = undefined;
			});
		return this.pending;
	}
}

const cache = new EmailSendingCache();
export const isEmailSendingEnabled = (): Promise<boolean> => cache.read();
