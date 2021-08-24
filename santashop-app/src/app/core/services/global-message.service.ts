import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FireCRUDStateless } from 'santashop-core/src';

@Injectable({
  providedIn: 'root'
})
export class GlobalMessageService {

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly toastController: ToastController
  ) { }

  
}
