import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

const toFileStreamMock = vi.fn();

describe('QR code storage helpers', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
		toFileStreamMock.mockReset();
		toFileStreamMock.mockResolvedValue(undefined);
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		vi.doMock('qrcode', () => ({ toFileStream: toFileStreamMock }));
		vi.doMock('../../../src/assets/cancelled-registration.png', () => ({
			default: 'data:image/png;base64,Y2FuY2VsbGVk',
		}));
	});

	const loadQrcodes = async () => import('../../../src/utility/qrcodes');

	it('creates unique registration-scoped image paths', async () => {
		const { createQrCodeStoragePath } = await loadQrcodes();
		const first = createQrCodeStoragePath('customer-1');
		const second = createQrCodeStoragePath('customer-1');

		expect(first).toMatch(/^registrations\/customer-1\/[\w-]+\.png$/);
		expect(second).not.toBe(first);
	});

	it('writes a high-error-correction PNG with private cache controls', async () => {
		const { generateQrCode } = await loadQrcodes();
		const stream = {};
		const file = adminMock.getFileRef('registrations/customer-1/code.png');
		(file as unknown as { createWriteStream: ReturnType<typeof vi.fn> }).createWriteStream =
			vi.fn(() => stream);

		await generateQrCode('registrations/customer-1/code.png', 'ABCD1234');

		expect(toFileStreamMock).toHaveBeenCalledWith(
			stream,
			'ABCD1234',
			{ errorCorrectionLevel: 'high', width: 600, margin: 3 },
		);
	});

	it('replaces an image after cancellation and safely deletes a QR image', async () => {
		const { deleteQrCode, replaceQrCodeWithCancelled } = await loadQrcodes();
		const path = 'registrations/customer-1/code.png';

		await replaceQrCodeWithCancelled(path);
		await deleteQrCode(path);

		expect(adminMock.getFileRef(path).save).toHaveBeenCalledWith(
			expect.any(Buffer),
			expect.objectContaining({
				public: true,
				contentType: 'image/png',
				metadata: { cacheControl: 'no-store, max-age=0, must-revalidate' },
			}),
		);
		expect(adminMock.getFileRef(path).delete).toHaveBeenCalledWith({
			ignoreNotFound: true,
		});
	});
});
