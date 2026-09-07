import {
	getRemoteConfig,
	type RemoteConfigParameter,
	type RemoteConfigTemplate,
} from 'firebase-admin/remote-config';
import admin from '../firebase-admin';
import {
	createDefaultPublicParameters,
	parsePublicParameters,
	parsePublicParametersJson,
	PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY,
	PUBLIC_PARAMETERS_RETRY_DELAYS_MS,
	type PublicParameters,
} from '../models';
import { createFunctionLogger } from './observability';

const log = createFunctionLogger('publicParameters');
export const isLocalPublicParameters = (): boolean => {
	if (process.env['FUNCTIONS_EMULATOR'] === 'true') {
		if (!process.env['FIRESTORE_EMULATOR_HOST'])
			throw new Error(
				'Firestore emulator host is required for local configuration.',
			);
		return true;
	}
	return false;
};
export const managedParameter = (
	template: RemoteConfigTemplate,
): RemoteConfigParameter => {
	const candidates = [
		template.parameters[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY],
		...Object.values(template.parameterGroups ?? {}).map(
			(group) => group.parameters[PUBLIC_PARAMETERS_REMOTE_CONFIG_KEY],
		),
	].filter((value): value is RemoteConfigParameter => value !== undefined);
	if (candidates.length !== 1)
		throw new Error(
			'The public settings parameter must exist exactly once.',
		);
	const parameter = candidates[0];
	if (parameter.valueType !== 'JSON')
		throw new Error('Public settings must use the JSON value type.');
	if (Object.keys(parameter.conditionalValues ?? {}).length)
		throw new Error('Public settings must be unconditional.');
	return parameter;
};
export const settingsFromTemplate = (
	template: RemoteConfigTemplate,
): PublicParameters => {
	const value = managedParameter(template).defaultValue;
	if (!value || !('value' in value))
		throw new Error('Public settings must have an explicit JSON default.');
	return parsePublicParametersJson(value.value);
};

export const withPublicParametersDeadline = async <T>(
	operation: Promise<T>,
): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() =>
						reject(new Error('Public settings request timed out.')),
					10_000,
				);
				timer.unref();
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
};

/** Configuration is independent of Firestore transactions; in-flight work retains its settings. */
export class PublicParametersCache {
	private current = createDefaultPublicParameters();
	private nextAttempt = 0;
	private failures = 0;
	private pending: Promise<void> | undefined;
	constructor(
		private readonly fetchSettings: () => Promise<PublicParameters>,
		private readonly now: () => number = Date.now,
	) {}
	public read(): PublicParameters {
		if (!this.pending && this.now() >= this.nextAttempt) {
			this.pending = withPublicParametersDeadline(
				Promise.resolve().then(() => this.fetchSettings()),
			)
				.then((value) => {
					this.current = parsePublicParameters(value);
					this.failures = 0;
					this.nextAttempt = this.now() + 10_000;
				})
				.catch(() => {
					this.nextAttempt =
						this.now() +
						PUBLIC_PARAMETERS_RETRY_DELAYS_MS[
							Math.min(
								this.failures++,
								PUBLIC_PARAMETERS_RETRY_DELAYS_MS.length - 1,
							)
						];
					log.warn(
						'Public settings refresh failed; retaining validated settings.',
					);
				})
				.finally(() => {
					this.pending = undefined;
				});
		}
		return parsePublicParameters(this.current);
	}
}
const cache = new PublicParametersCache(async () =>
	settingsFromTemplate(await getRemoteConfig().getTemplate()),
);
export const getPublicParameters = async (): Promise<PublicParameters> => {
	if (isLocalPublicParameters()) {
		const snapshot = await admin
			.firestore()
			.doc('_testConfig/publicParameters')
			.get();
		return snapshot.exists
			? parsePublicParameters(snapshot.data())
			: createDefaultPublicParameters();
	}
	return cache.read();
};
