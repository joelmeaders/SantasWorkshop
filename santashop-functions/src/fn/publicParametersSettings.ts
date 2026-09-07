import { getRemoteConfig } from 'firebase-admin/remote-config';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	parsePublicParameters,
	type PublicParametersSettingsResponse,
} from '../models';
import { requireOwner } from '../utility/capabilities';
import { createFunctionLogger } from '../utility/observability';
import {
	isLocalPublicParameters,
	managedParameter,
	settingsFromTemplate,
	withPublicParametersDeadline,
} from '../utility/public-parameters';
import { requireObject, requireOnlyKeys } from './registrationMutationSupport';

const log = createFunctionLogger('publicParametersSettings');
const changedPaths = (
	before: unknown,
	after: unknown,
	prefix = '',
): string[] => {
	if (after !== null && typeof after === 'object' && !Array.isArray(after)) {
		const previous = before as Record<string, unknown>;
		return Object.entries(after).flatMap(([key, value]) =>
			changedPaths(
				previous[key],
				value,
				prefix ? prefix + '.' + key : key,
			),
		);
	}
	return before === after ? [] : [prefix];
};
export const readPublicParametersSettings = async (
	request: CallableRequest<unknown>,
): Promise<PublicParametersSettingsResponse> => {
	requireOwner(request);
	requireOnlyKeys(requireObject(request.data), []);
	if (isLocalPublicParameters()) {
		const snapshot = await admin
			.firestore()
			.doc('_testConfig/publicParameters')
			.get();
		return {
			settings: parsePublicParameters(snapshot.data()),
			etag: snapshot.updateTime
				? `${snapshot.updateTime.seconds}:${snapshot.updateTime.nanoseconds}`
				: '0',
			version: snapshot.updateTime?.toMillis().toString() ?? '0',
		};
	}
	const template = await withPublicParametersDeadline(
		getRemoteConfig().getTemplate(),
	);
	return {
		settings: settingsFromTemplate(template),
		etag: template.etag,
		version: template.version?.versionNumber ?? '0',
	};
};
export const publishPublicParametersSettings = async (
	request: CallableRequest<unknown>,
): Promise<PublicParametersSettingsResponse> => {
	const actor = requireOwner(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['settings', 'expectedEtag']);
	if (
		typeof data['expectedEtag'] !== 'string' ||
		!data['expectedEtag'].trim() ||
		data['expectedEtag'].trim() === '*'
	)
		throw new HttpsError(
			'invalid-argument',
			'A specific configuration ETag is required.',
		);
	let settings;
	try {
		settings = parsePublicParameters(data['settings']);
	} catch {
		throw new HttpsError(
			'invalid-argument',
			'Settings must match the complete public configuration schema.',
		);
	}
	if (isLocalPublicParameters()) {
		const ref = admin.firestore().doc('_testConfig/publicParameters');
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
		return readPublicParametersSettings({ ...request, data: {} });
	}
	const remote = getRemoteConfig();
	const template = await withPublicParametersDeadline(remote.getTemplate());
	if (template.etag !== data['expectedEtag'])
		throw new HttpsError(
			'aborted',
			'Settings changed. Reload before publishing.',
		);
	const previous = settingsFromTemplate(template);
	managedParameter(template).defaultValue = {
		value: JSON.stringify(settings),
	};
	try {
		await remote.validateTemplate(template);
		const published = await remote.publishTemplate(template);
		const changedFields = changedPaths(previous, settings);
		log.info('Public settings published.', {
			actorUid: actor.uid,
			changedFields,
			version: published.version?.versionNumber,
		});
		return {
			settings: settingsFromTemplate(published),
			etag: published.etag,
			version: published.version?.versionNumber ?? '0',
		};
	} catch (error) {
		if (
			error &&
			typeof error === 'object' &&
			'code' in error &&
			error.code === 'remote-config/aborted'
		)
			throw new HttpsError(
				'aborted',
				'Settings changed. Reload before publishing.',
			);
		throw new HttpsError(
			'unavailable',
			'Settings could not be published. Reload to verify the current version before retrying.',
		);
	}
};
