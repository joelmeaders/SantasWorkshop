import { Injectable, inject } from '@angular/core';
import { StorageWrapper } from '@santashop/core';

@Injectable({
	providedIn: 'root',
})
export class QrCodeService {
	private readonly storage = inject(StorageWrapper);

	public registrationQrCodeUrl(storagePath: string): Promise<string> {
		return this.storage.getDownloadUrl(storagePath);
	}
}
