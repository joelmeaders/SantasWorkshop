import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FireCRUDStateless } from 'santashop-core/src/public-api';

@Injectable({
  providedIn: 'root'
})
export class GlobalMessageService {

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly toastController: ToastController
  ) { }

  
}
