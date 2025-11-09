import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	ModalController,
	IonLabel,
	IonIcon,
	IonButton,
	IonToolbar,
	IonFooter,
	IonContent,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

@Component({
	selector: 'app-terms-of-service-modal',
	templateUrl: './terms-of-service-modal.component.html',
	styleUrls: ['./terms-of-service-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonLabel,
		IonIcon,
		IonButton,
		IonToolbar,
		IonFooter,
		TranslateModule,
		IonContent,
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
	private readonly modalController = inject(ModalController);

	constructor() {
		addIcons({ closeCircle });
	}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
