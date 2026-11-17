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
	getPublicParameters,
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

interface WaitingListAccess {
	settings: WaitingListSettings;
	maintenanceModeEnabled: boolean;
}

const defaultWaitingListAccess = (): WaitingListAccess => ({
	settings: defaultWaitingListSettings(),
	maintenanceModeEnabled: false,
});

let current = defaultWaitingListAccess();
let expiresAt = 0;
let pending: Promise<WaitingListAccess> | undefined;

export const getWaitingListAccess = async (): Promise<WaitingListAccess> => {
	if (isLocalPublicParameters()) {
		const [snapshot, parameters] = await Promise.all([
			admin.firestore().doc('_testConfig/waitingList').get(),
			getPublicParameters(),
		]);
		try {
			return {
				settings: parseWaitingListSettings(snapshot.data()),
				maintenanceModeEnabled: parameters.maintenanceModeEnabled,
			};
		} catch {
			return defaultWaitingListAccess();
		}
	}
	if (Date.now() < expiresAt) return current;
	pending ??= fetchPublicParametersEnvelope()
		.then((response) => {
			current =
				response.source === 'fresh'
					? {
							settings: parseWaitingListSettings(response.waitingList),
							maintenanceModeEnabled: response.settings.maintenanceModeEnabled,
						}
					: defaultWaitingListAccess();
			expiresAt = Date.now() + 10_000;
			return current;
		})
		.catch(() => {
			current = defaultWaitingListAccess();
			expiresAt = Date.now() + 10_000;
			return current;
		})
		.finally(() => {
			pending = undefined;
		});
	return pending;
};

export const getWaitingListSettings = async (): Promise<WaitingListSettings> =>
	({ ...(await getWaitingListAccess()).settings });
