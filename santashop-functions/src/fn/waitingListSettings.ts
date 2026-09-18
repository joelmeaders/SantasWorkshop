import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	parseWaitingListSettings,
	WAITING_LIST_REMOTE_CONFIG_KEY,
	type WaitingListSettingsResponse,
} from '../models';
import { requireOwner } from '../utility/capabilities';
import {
	isLocalPublicParameters,
	withPublicParametersDeadline,
} from '../utility/public-parameters';
import { waitingListSettingsFromTemplate } from '../utility/waiting-list-settings';
import { createFunctionLogger } from '../utility/observability';
import { requireObject, requireOnlyKeys } from './registrationMutationSupport';

const log = createFunctionLogger('waitingListSettings');
export const readWaitingListSettings = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListSettingsResponse> => {
	requireOwner(request);
	requireOnlyKeys(requireObject(request.data), []);
	if (isLocalPublicParameters()) {
		const snapshot = await admin
			.firestore()
			.doc('_testConfig/waitingList')
			.get();
		return {
			settings: parseWaitingListSettings(snapshot.data()),
			etag: snapshot.updateTime
				? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
				: '0',
			version: snapshot.updateTime
				? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
				: '0',
		};
	}
	const template = await withPublicParametersDeadline(
		admin.remoteConfig().getTemplate(),
	);
	return {
		settings: waitingListSettingsFromTemplate(template),
		etag: template.etag,
		version: template.version?.versionNumber ?? '0',
	};
};

export const publishWaitingListSettings = async (
	request: CallableRequest<unknown>,
): Promise<WaitingListSettingsResponse> => {
	const actor = requireOwner(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['settings', 'expectedEtag']);
	if (
		typeof data['expectedEtag'] !== 'string' ||
		!data['expectedEtag'].trim() ||
		data['expectedEtag'] === '*'
	)
		throw new HttpsError(
			'invalid-argument',
			'A specific settings version is required.',
		);
	let settings;
	try {
		settings = parseWaitingListSettings(data['settings']);
	} catch {
		throw new HttpsError(
			'invalid-argument',
			'Waiting list settings require two boolean controls.',
		);
	}
	if (data['settings'] === undefined)
		throw new HttpsError('invalid-argument', 'Settings are required.');
	if (isLocalPublicParameters()) {
		const ref = admin.firestore().doc('_testConfig/waitingList');
		await admin.firestore().runTransaction(async (transaction) => {
			const snapshot = await transaction.get(ref);
			if (
				(snapshot.updateTime
					? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
					: '0') !== data['expectedEtag']
			)
				throw new HttpsError(
					'aborted',
					'Settings changed. Reload before publishing.',
				);
			transaction.set(ref, settings);
		});
		return readWaitingListSettings({ ...request, data: {} });
	}
	const remote = admin.remoteConfig();
	const template = await withPublicParametersDeadline(remote.getTemplate());
	if (template.etag !== data['expectedEtag'])
		throw new HttpsError(
			'aborted',
			'Settings changed. Reload before publishing.',
		);
	// Preserve every unrelated parameter, including the legacy public-settings JSON.
	const groups = Object.values(template.parameterGroups ?? {}).filter(
		(group) => group.parameters[WAITING_LIST_REMOTE_CONFIG_KEY],
	);
	if (
		groups.length ||
		(template.parameters[WAITING_LIST_REMOTE_CONFIG_KEY]?.conditionalValues &&
			Object.keys(
				template.parameters[WAITING_LIST_REMOTE_CONFIG_KEY].conditionalValues ??
					{},
			).length)
	)
		throw new HttpsError(
			'failed-precondition',
			'Waiting list controls must be unconditional top-level settings.',
		);
	template.parameters[WAITING_LIST_REMOTE_CONFIG_KEY] = {
		valueType: 'JSON',
		defaultValue: { value: JSON.stringify(settings) },
	};
	try {
		await remote.validateTemplate(template);
		const published = await remote.publishTemplate(template);
		log.info('Waiting list controls published.', {
			actorUid: actor.uid,
			settings,
			version: published.version?.versionNumber,
		});
		return {
			settings,
			etag: published.etag,
			version: published.version?.versionNumber ?? '0',
		};
	} catch (error) {
		if (
			typeof error === 'object' &&
			error &&
			'code' in error &&
			error.code === 'remote-config/aborted'
		)
			throw new HttpsError(
				'aborted',
				'Settings changed. Reload before publishing.',
			);
		throw new HttpsError(
			'unavailable',
			'Publication was not confirmed. Reload settings before retrying.',
		);
	}
};
