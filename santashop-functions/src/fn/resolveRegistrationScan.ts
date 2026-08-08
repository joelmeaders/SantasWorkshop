import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
	type ResolveRegistrationScanRequest,
	type ResolveRegistrationScanResult,
} from '../models';
import { canCheckInToken } from '../utility/capabilities';
import { resolveRegistrationCode } from '../utility/registration-scan';

const normalizeRequest = (data: unknown): ResolveRegistrationScanRequest => {
	if (typeof data !== 'object' || data === null) {
		throw new HttpsError('invalid-argument', 'Scan details are required.');
	}
	const values = data as Record<string, unknown>;
	const code = typeof values['code'] === 'string' ? values['code'].trim() : '';
	const inputMethod = values['inputMethod'];
	if (!/^[A-Za-z0-9]{8}$/.test(code)) {
		throw new HttpsError('invalid-argument', 'Enter a valid 8-character code.');
	}
	if (inputMethod !== 'camera' && inputMethod !== 'manual') {
		throw new HttpsError('invalid-argument', 'Scan input method is invalid.');
	}
	return { code, inputMethod };
};

export default async function resolveRegistrationScan(
	request: CallableRequest<ResolveRegistrationScanRequest>,
): Promise<ResolveRegistrationScanResult> {
	if (!request.auth?.uid) {
		throw new HttpsError('unauthenticated', 'Authentication is required.');
	}
	if (!canCheckInToken(request.auth.token)) {
		throw new HttpsError(
			'permission-denied',
			'Check-in access is required to scan registrations.',
		);
	}
	const data = normalizeRequest(request.data);
	return resolveRegistrationCode(
		data.code,
		data.inputMethod,
		request.auth.uid,
	);
}
