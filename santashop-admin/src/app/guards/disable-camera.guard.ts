import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { ScannerPage } from '../features/admin/scanner/scanner.page';
import { ScannerService } from '../services/scanner.service';

@Injectable()
export class ConfirmDeactivateGuard implements CanDeactivate<ScannerPage> {
  constructor(
    private readonly scannerService: ScannerService,
    private readonly loadingController: LoadingController
  ) {}
  // Navigating away from scanner page won't shut off camera due
  // to library bug. This solves that, mostly.
  async canDeactivate(): Promise<boolean> {
    this.scannerService.navigatedAway();

    const loading = await this.loadingController.create({
      message: 'Please Wait...',
      duration: 1000,
    });

    await loading.present();

    const sleep = new Promise((resolve) => setTimeout(resolve, 1000));
    await sleep;
    return true;
  }
}
