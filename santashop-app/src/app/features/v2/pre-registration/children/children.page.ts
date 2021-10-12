import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChildValidationService, IChild } from '@core/*';
import { AlertController, ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ChildModalComponent } from './child-modal/child-modal.component';
import { ChildrenPageService } from './children.page.service';

@Component({
  selector: 'app-children',
  templateUrl: './children.page.html',
  styleUrls: ['./children.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ ChildrenPageService, ChildValidationService ]
})
export class ChildrenPage {

  public readonly children$: Observable<IChild[] | undefined> =
    this.viewService.children$;

  public readonly childCount$: Observable<number> =
    this.viewService.childCount$;

  constructor(
    private readonly viewService: ChildrenPageService,
    private readonly modalController: ModalController,
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) { }

  public async addChild() {
    const modal = await this.modalController.create({
      component: ChildModalComponent
    });
    
    await modal.present();

    var result = await modal.onDidDismiss();

    if (result.data) {
      await this.viewService.addChild(result.data as IChild);
    }
  }

  public async removeChild(child: IChild): Promise<void> {
    if (await this.confirmDeleteChild()) {
      return this.viewService.removeChild(child);
    }
  }

  private async confirmDeleteChild(): Promise<boolean> {

    const alert = await this.alertController.create({
      // TODO: This stuff
      header: this.translateService.instant('Confirm Changes'),
      subHeader: this.translateService.instant('Are you sure you want to do this?'),
      message: this.translateService.instant('The slot you already have may no longer be available if you continue.'),
      buttons: [
        {
          text: 'Go Back',
          role: 'cancel'
        },
        {
          text: 'Continue'
        }
      ]
    });

    await alert.present();
    return alert.onDidDismiss()
      .then(e => e.role != 'cancel');
  }
}
