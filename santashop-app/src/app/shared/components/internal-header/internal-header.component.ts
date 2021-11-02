import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { PopoverController } from '@ionic/angular';
import { PublicMenuComponent } from '../public-menu/public-menu.component';

@Component({
  selector: 'app-internal-header',
  templateUrl: './internal-header.component.html',
  styleUrls: ['./internal-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InternalHeaderComponent {

  public readonly userRegistration$ = this.preregistrationService.userRegistration$;

  constructor(
    private readonly preregistrationService: PreRegistrationService,
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
