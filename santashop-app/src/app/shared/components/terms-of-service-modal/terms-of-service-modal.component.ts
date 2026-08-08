import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	ModalController,
	IonIcon,
	IonButton,
	IonButtons,
	IonTitle,
	IonToolbar,
	IonHeader,
	IonContent,
} from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

@Component({
	selector: 'app-terms-of-service-modal',
	templateUrl: './terms-of-service-modal.component.html',
	styleUrls: ['./terms-of-service-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButtons,
		IonButton,
		IonIcon,
		IonContent,
		TranslateModule,
	],
})
export class TermsOfServiceModalComponent {
	private readonly modalController = inject(ModalController);

	constructor() {
		addIcons({ closeCircle });
	}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
