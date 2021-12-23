import { Injectable } from "@angular/core";
import { ref, Storage, getDownloadURL } from '@angular/fire/storage';


@Injectable({
  providedIn: 'root',
})
export class QrCodeService {

  constructor(
    private readonly storage: Storage
  ) {}

  public registrationQrCodeUrl(uid: string): Promise<string> {
    const qrCodeRef = ref(this.storage, `registrations/${uid}.png`);
    return getDownloadURL(qrCodeRef);
  }

}