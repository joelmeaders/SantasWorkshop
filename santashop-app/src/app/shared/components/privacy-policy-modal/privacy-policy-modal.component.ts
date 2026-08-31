import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	ModalController,
	IonContent,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonButtons,
	IonButton,
	IonIcon,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

@Component({
	selector: 'app-privacy-policy-modal',
	templateUrl: './privacy-policy-modal.component.html',
	styleUrls: ['./privacy-policy-modal.component.scss'],
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
export class PrivacyPolicyModalComponent {
	private readonly modalController = inject(ModalController);

	constructor() {
		addIcons({ closeCircle });
	}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
