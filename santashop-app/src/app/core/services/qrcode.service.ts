import { Injectable, inject } from '@angular/core';
import { ref, Storage, getDownloadURL } from '@angular/fire/storage';

@Injectable({
	providedIn: 'root',
})
export class QrCodeService {
	private readonly storage = inject(Storage);

	public registrationQrCodeUrl(uid: string): Promise<string> {
		const qrCodeRef = ref(this.storage, `registrations/${uid}.png`);
		return getDownloadURL(qrCodeRef);
	}
}
