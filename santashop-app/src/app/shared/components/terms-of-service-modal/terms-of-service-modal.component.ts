import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	ModalController,
	IonLabel,
	IonIcon,
	IonButton,
	IonToolbar,
	IonFooter,
	IonContent,
	IonCol,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

@Component({
	selector: 'app-terms-of-service-modal',
	templateUrl: './terms-of-service-modal.component.html',
	styleUrls: ['./terms-of-service-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		IonLabel,
		IonIcon,
		IonButton,
		IonToolbar,
		IonFooter,
		TranslateModule,
		IonContent,
		IonCol,
		IonContent,
		IonFooter,
		IonToolbar,
		IonButton,
		IonIcon,
		IonLabel,
	],
	providers: [ModalController],
})
export class TermsOfServiceModalComponent {
	constructor(private readonly modalController: ModalController) {
		addIcons({ closeCircle });
	}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
