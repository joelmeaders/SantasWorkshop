import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
	selector: 'app-privacy-policy-modal',
	templateUrl: './privacy-policy-modal.component.html',
	styleUrls: ['./privacy-policy-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPolicyModalComponent {
	constructor(private readonly modalController: ModalController) {}

	public onDismiss(): void {
		this.modalController.dismiss();
	}
}
