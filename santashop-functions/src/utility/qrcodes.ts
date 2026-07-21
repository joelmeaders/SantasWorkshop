import * as qrcode from 'qrcode';
import admin from '../firebase-admin';

export function generateQrCode(uid: string, code: string): Promise<void> {
	const storage = admin.storage().bucket();
	const imageToCreate = storage.file(`registrations/${uid}.png`);
	const fileStream = imageToCreate.createWriteStream({
		public: true,
		contentType: 'auto',
		resumable: false,
	});

	return qrcode.toFileStream(fileStream, code, {
		errorCorrectionLevel: 'high',
		width: 600,
		margin: 3,
	});
}

export async function deleteQrCode(uid: string): Promise<void> {
	const storage = admin.storage().bucket();
	const imageToDelete = storage.file(`registrations/${uid}.png`);
	await imageToDelete.delete({ ignoreNotFound: true });
}
