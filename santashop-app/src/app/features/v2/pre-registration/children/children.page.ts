import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	AlertController,
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonItem,
	IonCardTitle,
	IonList,
	IonLabel,
	IonCardHeader,
	IonText,
	IonCardSubtitle,
} from '@ionic/angular/standalone';
import { Child } from '@santashop/models';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ChildrenPageService } from './children.page.service';
import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import {
	arrowBackSharp,
	addCircle,
	manOutline,
	womanOutline,
	happyOutline,
	alertCircle,
	createOutline,
	trashOutline,
} from 'ionicons/icons';

@Component({
	selector: 'app-children',
	templateUrl: './children.page.html',
	styleUrls: ['./children.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ChildrenPageService],
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		AsyncPipe,
		DatePipe,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonItem,
		IonCardTitle,
		IonList,
		IonLabel,
		IonCardHeader,
		IonText,
		IonCardSubtitle,
	],
})
export class ChildrenPage {
	private readonly viewService = inject(ChildrenPageService);
	private readonly alertController = inject(AlertController);
	private readonly translateService = inject(TranslateService);

	public readonly children$: Observable<Child[] | undefined> =
		this.viewService.children$;

	public readonly childCount$: Observable<number> =
		this.viewService.childCount$;

	constructor() {
		addIcons({
			arrowBackSharp,
			addCircle,
			manOutline,
			womanOutline,
			happyOutline,
			alertCircle,
			createOutline,
			trashOutline,
		});
	}

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
