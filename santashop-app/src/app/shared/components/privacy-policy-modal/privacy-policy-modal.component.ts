import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	ModalController,
	IonContent,
	IonFooter,
	IonToolbar,
	IonButton,
	IonIcon,
	IonLabel,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

@Component({
	selector: 'app-privacy-policy-modal',
	templateUrl: './privacy-policy-modal.component.html',
	styleUrls: ['./privacy-policy-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		IonContent,
		IonFooter,
		IonToolbar,
		IonButton,
		IonIcon,
		IonLabel,
		TranslateModule,
		IonContent,
		IonFooter,
		IonToolbar,
		IonButton,
		IonIcon,
		IonLabel,
	],
})
export class PrivacyPolicyModalComponent {
	constructor(private readonly modalController: ModalController) {
		addIcons({ closeCircle });
	}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
