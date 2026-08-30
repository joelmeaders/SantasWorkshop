import * as qrcode from 'qrcode';
import { randomUUID } from 'node:crypto';
import admin from '../firebase-admin';
import { getCancelledRegistrationAsset } from './bundled-assets';

const QR_CACHE_CONTROL = 'no-store, max-age=0, must-revalidate';
const FIREBASE_DOWNLOAD_TOKEN_KEY = 'firebaseStorageDownloadTokens';

const createQrMetadata = (): {
	cacheControl: string;
	metadata: Record<string, string>;
} => ({
	cacheControl: QR_CACHE_CONTROL,
	metadata: { [FIREBASE_DOWNLOAD_TOKEN_KEY]: randomUUID() },
});

export const createQrCodeStoragePath = (uid: string): string =>
	`registrations/${uid}/${randomUUID()}.png`;

export function generateQrCode(
	storagePath: string,
	code: string,
): Promise<void> {
	const storage = admin.storage().bucket();
	const imageToCreate = storage.file(storagePath);
	const fileStream = imageToCreate.createWriteStream({
		contentType: 'image/png',
		resumable: false,
		metadata: createQrMetadata(),
	});

	return qrcode.toFileStream(fileStream, code, {
		errorCorrectionLevel: 'high',
		width: 600,
		margin: 3,
	});
}

export async function replaceQrCodeWithCancelled(
	storagePath: string,
): Promise<void> {
	await admin.storage().bucket().file(storagePath).save(getCancelledRegistrationAsset(), {
		resumable: false,
		contentType: 'image/png',
		metadata: createQrMetadata(),
	});
}

export async function getRegistrationQrCodeUrl(
	storagePath: string,
): Promise<string> {
	const bucket = admin.storage().bucket();
	const [metadata] = await bucket.file(storagePath).getMetadata();
	const customMetadata = metadata.metadata as
		| Record<string, string | undefined>
		| undefined;
	const token = customMetadata?.[FIREBASE_DOWNLOAD_TOKEN_KEY];
	if (!token) {
		throw new Error('Registration QR image download token is unavailable.');
	}

	return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
		bucket.name,
	)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(
		token,
	)}`;
}

export async function deleteQrCode(storagePath: string): Promise<void> {
	const storage = admin.storage().bucket();
	const imageToDelete = storage.file(storagePath);
	await imageToDelete.delete({ ignoreNotFound: true });
}
