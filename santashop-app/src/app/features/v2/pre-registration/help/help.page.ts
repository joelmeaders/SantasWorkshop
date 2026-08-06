import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonCard,
	IonCardHeader,
	IonItem,
	IonCardTitle,
	IonCardContent,
	IonText,
	ModalController,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-help',
	templateUrl: './help.page.html',
	styleUrls: ['./help.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonCard,
		IonCardHeader,
		IonItem,
		IonCardTitle,
		IonCardContent,
		IonText,
	],
})
export class HelpPage {
	private readonly modalController = inject(ModalController);

	constructor() {
		addIcons({ arrowBackSharp });
	}

	public async close(): Promise<void> {
		await this.modalController.dismiss();
	}
}
