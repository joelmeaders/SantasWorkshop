import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { PopoverController } from '@ionic/angular';
import { PublicMenuComponent } from '../../../../shared/components/public-menu/public-menu.component';

@Component({
  selector: 'app-confirmation',
  templateUrl: './confirmation.page.html',
  styleUrls: ['./confirmation.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationPage {

  constructor(
    public readonly viewService: PreRegistrationService,
    private readonly popoverController: PopoverController
    ) { }

  public async menu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event,
      translucent: true
    });
    await popover.present();
  }

}
