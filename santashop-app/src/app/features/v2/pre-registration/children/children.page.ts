import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Child } from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { Observable, tap } from 'rxjs';
import { AppStateService } from '../../../../core';
import { ChildrenPageService } from './children.page.service';
import { RegistrationClosedPage } from '../../../registration-closed/registration-closed.page';

@Component({
	selector: 'app-children',
	templateUrl: './children.page.html',
	styleUrls: ['./children.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ChildrenPageService],
})
export class ChildrenPage {
	public readonly children$: Observable<Child[] | undefined> =
		this.viewService.children$;

	public readonly childCount$: Observable<number> =
		this.viewService.childCount$;

	protected readonly closedSubscription =
		this.appStateService.isRegistrationEnabled$
			.pipe(
				tap((enabled) => {
					if (!enabled)
						this.appStateService.setModal(RegistrationClosedPage);
				}),
			)
			.subscribe();

	constructor(
		private readonly viewService: ChildrenPageService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
		private readonly appStateService: AppStateService,
	) {}

	public async removeChild(child: Child): Promise<void> {
		if (await this.confirmDeleteChild(child)) {
			return this.viewService.removeChild(child);
		}
	}

	private async confirmDeleteChild(child: Child): Promise<boolean> {
		const alert = await this.alertController.create({
			header: this.translateService.instant(
				'ADDCHILD.DELETE_CHILD_TITLE',
			),
			subHeader: `${child.firstName} ${child.lastName}`,
			message: this.translateService.instant('ADDCHILD.DELETE_CHILD_MSG'),
			buttons: [
				{
					text: this.translateService.instant('COMMON.GO_BACK'),
					role: 'cancel',
				},
				{
					text: this.translateService.instant('COMMON.OK'),
					role: 'destructive',
					cssClass: 'confirm-delete-button',
				},
			],
		});

		await alert.present();

		return alert.onDidDismiss().then((e) => {
			return e.role === 'destructive';
		});
	}
}
