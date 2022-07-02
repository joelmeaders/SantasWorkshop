import * as qrcode from 'qrcode';
import * as admin from 'firebase-admin';

export function generateQrCode(uid: string, code: string): Promise<any> {
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
