import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { PopoverController } from '@ionic/angular';
import { PublicMenuComponent } from '../../../../shared/components/public-menu/public-menu.component';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage {

  public readonly userRegistration$ = this.preregistrationService.userRegistration$;
  public readonly children$ = this.preregistrationService.children$;
  public readonly childCount$ = this.preregistrationService.childCount$;
  public readonly dateTImeSlot$ = this.preregistrationService.dateTimeSlot$;
  public readonly registrationSubmitted$ = this.preregistrationService.registrationSubmitted$;

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
