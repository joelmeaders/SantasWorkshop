import { TestBed } from '@angular/core/testing';
import { StorageWrapper } from '@santashop/core';
import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { QrCodeService } from './qrcode.service';

describe('QrCodeService', () => {
	let service: QrCodeService;
	let storage: Mocked<Pick<StorageWrapper, 'getDownloadUrl'>>;

	beforeEach(() => {
		storage = {
			getDownloadUrl: vi.fn().mockResolvedValue('https://example.test/qr.png'),
		};
		TestBed.configureTestingModule({
			providers: [{ provide: StorageWrapper, useValue: storage }],
		});
		service = TestBed.inject(QrCodeService);
	});

	it('loads a registration QR image from its canonical storage path', async () => {
		const storagePath = 'registrations/customer-123/test-asset.png';
		await expect(service.registrationQrCodeUrl(storagePath)).resolves.toBe(
			'https://example.test/qr.png',
		);
		expect(storage.getDownloadUrl).toHaveBeenCalledWith(storagePath);
	});

	it('propagates storage failures to the caller', async () => {
		storage.getDownloadUrl.mockRejectedValue(new Error('missing QR image'));

		await expect(service.registrationQrCodeUrl('missing')).rejects.toThrow(
			'missing QR image',
		);
	});
});
