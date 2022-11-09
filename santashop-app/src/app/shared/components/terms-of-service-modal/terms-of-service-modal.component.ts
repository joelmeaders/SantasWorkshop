import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
	selector: 'app-terms-of-service-modal',
	templateUrl: './terms-of-service-modal.component.html',
	styleUrls: ['./terms-of-service-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsOfServiceModalComponent {
	constructor(private readonly modalController: ModalController) {}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
