import { Injectable, inject } from '@angular/core';
import { StorageWrapper } from '@santashop/core';

@Injectable({
	providedIn: 'root',
})
export class QrCodeService {
	private readonly storage = inject(StorageWrapper);

	public registrationQrCodeUrl(uid: string): Promise<string> {
		return this.storage.getDownloadUrl(`registrations/${uid}.png`);
	}
}
