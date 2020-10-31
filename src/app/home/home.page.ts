import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {

  constructor(
    private readonly popoverController: PopoverController
  ) {}

  public async profileMenu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event
    });
    return await popover.present();
  }

}
