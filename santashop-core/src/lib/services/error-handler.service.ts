import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { IError } from '../models/error.model';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  // TODO: Log errors to cloud function

  constructor(
    private readonly alertController: AlertController
  ) { }

  public async handleError(error: IError): Promise<any> {

    const alert = await this.alertController.create({
      header: 'Error Encountered',
      subHeader: `code: ${error.code}`,
      message: error.details,
      buttons: ['Ok']
    });

    await alert.present();
    return alert.onDidDismiss();
  }
}
