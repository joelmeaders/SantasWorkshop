import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChildValidationService } from '@core/*';
import { AlertController } from '@ionic/angular';
import { IChild } from '@models/*';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
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
    private readonly alertController: AlertController,
    private readonly translateService: TranslateService
  ) { }

  public async removeChild(child: IChild): Promise<void> {
    if (await this.confirmDeleteChild(child)) {
      return this.viewService.removeChild(child);
    }
  }

  private async confirmDeleteChild(child: IChild): Promise<boolean> {

    const alert = await this.alertController.create({
      // TODO: This stuff
      header: this.translateService.instant('ADDCHILD.DELETE_CHILD_TITLE'),
      subHeader: `${child.firstName} ${child.lastName}`,
      message: this.translateService.instant('ADDCHILD.DELETE_CHILD_MSG'),
      buttons: [
        {
          text: 'Go Back',
          role: 'cancel'
        },
        {
          text: 'Yes',
          role: 'destructive',
          cssClass: 'confirm-delete-button'
        }
      ]
    });

    await alert.present();

    return alert.onDidDismiss()
      .then(e => {
        console.log(e)
        return false;
        return e.role === 'destructive'
      });
  }
}
