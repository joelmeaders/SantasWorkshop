import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import cancelledRegistrationDataUrl from '../assets/cancelled-registration.png';

const decodeDataUrl = (value: string): Buffer | undefined => {
	const marker = ';base64,';
	const markerIndex = value.indexOf(marker);
	if (markerIndex < 0) return undefined;
	return Buffer.from(value.slice(markerIndex + marker.length), 'base64');
};

export const getCancelledRegistrationAsset = (): Buffer => {
	const inlineAsset = decodeDataUrl(cancelledRegistrationDataUrl);
	if (inlineAsset?.length) return inlineAsset;

	// Vitest serves imported static assets as paths instead of webpack data URLs.
	// The deployed bundle takes the inline branch; these paths keep source-level
	// emulator and integration tests faithful to the same bytes.
	for (const candidate of [
		path.resolve(process.cwd(), 'src/assets/cancelled-registration.png'),
		path.resolve(
			process.cwd(),
			'santashop-functions/src/assets/cancelled-registration.png',
		),
	]) {
		if (existsSync(candidate)) return readFileSync(candidate);
	}

	throw new Error('Cancelled registration image is unavailable.');
};
