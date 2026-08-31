import { TestBed } from '@angular/core/testing';
import {
	getDownloadURL,
	ref,
	type FirebaseStorage,
	type StorageReference,
} from 'firebase/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_STORAGE } from '../tokens';
import { StorageWrapper } from './_storage-wrapper';

vi.mock('firebase/storage', () => ({
	getDownloadURL: vi.fn(),
	ref: vi.fn(),
}));

describe('StorageWrapper', () => {
	let service: StorageWrapper;
	const storage = {} as FirebaseStorage;
	const reference = { fullPath: 'registrations/code.png' } as StorageReference;

	beforeEach(() => {
		vi.mocked(ref).mockReset();
		vi.mocked(getDownloadURL).mockReset();
		TestBed.configureTestingModule({
			providers: [{ provide: FIREBASE_STORAGE, useValue: storage }],
		});
		service = TestBed.inject(StorageWrapper);
	});

	it('creates a reference for a storage path', () => {
		vi.mocked(ref).mockReturnValue(reference);

		expect(service.ref('registrations/code.png')).toBe(reference);
		expect(ref).toHaveBeenCalledWith(storage, 'registrations/code.png');
	});

	it('gets a download URL from a path or an existing reference', async () => {
		vi.mocked(ref).mockReturnValue(reference);
		vi.mocked(getDownloadURL).mockResolvedValue('https://example.test/code.png');

		await expect(service.getDownloadUrl('registrations/code.png')).resolves.toBe(
			'https://example.test/code.png',
		);
		await expect(service.getDownloadUrl(reference)).resolves.toBe(
			'https://example.test/code.png',
		);

		expect(ref).toHaveBeenCalledOnce();
		expect(getDownloadURL).toHaveBeenNthCalledWith(1, reference);
		expect(getDownloadURL).toHaveBeenNthCalledWith(2, reference);
	});
});
