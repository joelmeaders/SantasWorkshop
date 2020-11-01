import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { PublicMenuComponent } from '@app/shared/components/public-menu/public-menu.component';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage implements OnInit {

  constructor(
    private readonly popoverController: PopoverController,
    private readonly analyticsService: AngularFireAnalytics
  ) {
    analyticsService.setCurrentScreen('home');
    analyticsService.logEvent('screen_view');
  }

  public async profileMenu($event: any) {
    const popover = await this.popoverController.create({
      component: PublicMenuComponent,
      event: $event
    });
    return await popover.present();
  }

  ngOnInit() {

  }

}
