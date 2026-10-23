import * as qrcode from 'qrcode';
import { createHash, randomUUID } from 'node:crypto';
import { getErrorCode } from './errors';
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

export async function ensureSignupQrCode(
	uid: string,
	storagePath: string,
	code: string,
): Promise<void> {
	if (!storagePath.startsWith(`registrations/${uid}/`))
		throw new Error('Signup QR path does not belong to this account.');
	const file = admin.storage().bucket().file(storagePath);
	const codeHash = createHash('sha256').update(code).digest('hex');
	const verifyExisting = async (): Promise<boolean> => {
		try {
			const [metadata] = await file.getMetadata();
			if (
				metadata.metadata?.['signupOwnerUid'] !== uid ||
				metadata.metadata?.['signupCodeHash'] !== codeHash
			)
				throw new Error(
					'Signup QR ownership does not match. Contact support.',
				);
			return true;
		} catch (error) {
			if (getErrorCode(error) === '404') return false;
			throw error;
		}
	};
	if (await verifyExisting()) return;
	try {
		const metadata = createQrMetadata();
		await file.save(
			await qrcode.toBuffer(code, {
				errorCorrectionLevel: 'high',
				width: 600,
				margin: 3,
			}),
			{
				resumable: false,
				contentType: 'image/png',
				preconditionOpts: { ifGenerationMatch: 0 },
				metadata: {
					...metadata,
					metadata: {
						...metadata.metadata,
						signupOwnerUid: uid,
						signupCodeHash: codeHash,
					},
				},
			},
		);
	} catch (error) {
		if (!(await verifyExisting())) throw error;
	}
}

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
	await admin
		.storage()
		.bucket()
		.file(storagePath)
		.save(getCancelledRegistrationAsset(), {
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
		Record<string, string | undefined> | undefined;
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
