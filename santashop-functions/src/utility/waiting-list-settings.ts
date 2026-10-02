import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
import {
	defaultWaitingListSettings,
	parseWaitingListSettings,
	WAITING_LIST_REMOTE_CONFIG_KEY,
	type WaitingListSettings,
} from '../models';
import admin from '../firebase-admin';
import {
	fetchPublicParametersEnvelope,
	isLocalPublicParameters,
} from './public-parameters';

/** A bad waiting-list parameter cannot invalidate the public registration controls. */
export const waitingListSettingsFromTemplate = (
	template: RemoteConfigTemplate,
): WaitingListSettings => {
	try {
		const candidates = [
			template.parameters?.[WAITING_LIST_REMOTE_CONFIG_KEY],
			...Object.values(template.parameterGroups ?? {}).map(
				(group) => group.parameters[WAITING_LIST_REMOTE_CONFIG_KEY],
			),
		].filter((value) => value !== undefined);
		if (!candidates.length) return defaultWaitingListSettings();
		const parameter = candidates[0];
		if (
			candidates.length !== 1 ||
			parameter.valueType !== 'JSON' ||
			Object.keys(parameter.conditionalValues ?? {}).length ||
			!parameter.defaultValue ||
			!('value' in parameter.defaultValue)
		)
			return defaultWaitingListSettings();
		return parseWaitingListSettings(
			JSON.parse(parameter.defaultValue.value) as unknown,
		);
	} catch {
		return defaultWaitingListSettings();
	}
};

let current = defaultWaitingListSettings();
let expiresAt = 0;
let pending: Promise<WaitingListSettings> | undefined;

export const getWaitingListSettings =
	async (): Promise<WaitingListSettings> => {
		if (isLocalPublicParameters()) {
			const snapshot = await admin
				.firestore()
				.doc('_testConfig/waitingList')
				.get();
			try {
				return parseWaitingListSettings(snapshot.data());
			} catch {
				return defaultWaitingListSettings();
			}
		}
		if (Date.now() < expiresAt) return { ...current };
		pending ??= fetchPublicParametersEnvelope()
			.then((response) => {
				current =
					response.source === 'fresh'
						? parseWaitingListSettings(response.waitingList)
						: defaultWaitingListSettings();
				expiresAt = Date.now() + 10_000;
				return { ...current };
			})
			.catch(() => {
				current = defaultWaitingListSettings();
				expiresAt = Date.now() + 10_000;
				return { ...current };
			})
			.finally(() => {
				pending = undefined;
			});
		return pending;
	};
