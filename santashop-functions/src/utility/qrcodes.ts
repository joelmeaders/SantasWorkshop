import * as qrcode from 'qrcode';
import { randomUUID } from 'node:crypto';
import admin from '../firebase-admin';
import cancelledRegistrationDataUrl from '../assets/cancelled-registration.png';

const QR_CACHE_CONTROL = 'no-store, max-age=0, must-revalidate';

export const createQrCodeStoragePath = (uid: string): string =>
	`registrations/${uid}/${randomUUID()}.png`;

export function generateQrCode(
	storagePath: string,
	code: string,
): Promise<void> {
	const storage = admin.storage().bucket();
	const imageToCreate = storage.file(storagePath);
	const fileStream = imageToCreate.createWriteStream({
		public: true,
		contentType: 'image/png',
		resumable: false,
		metadata: { cacheControl: QR_CACHE_CONTROL },
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
	const encoded = cancelledRegistrationDataUrl.split(',', 2)[1];
	if (!encoded) throw new Error('Cancelled registration image is unavailable.');
	await admin.storage().bucket().file(storagePath).save(Buffer.from(encoded, 'base64'), {
		public: true,
		resumable: false,
		contentType: 'image/png',
		metadata: { cacheControl: QR_CACHE_CONTROL },
	});
}

export async function deleteQrCode(storagePath: string): Promise<void> {
	const storage = admin.storage().bucket();
	const imageToDelete = storage.file(storagePath);
	await imageToDelete.delete({ ignoreNotFound: true });
}
