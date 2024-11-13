import { ModalController } from '@ionic/angular/standalone';
import { PrivacyPolicyModalComponent } from './components/privacy-policy-modal/privacy-policy-modal.component';
import { TermsOfServiceModalComponent } from './components/terms-of-service-modal/terms-of-service-modal.component';

export abstract class LegalHelpers {
	public static async privacyPolicy(
		modalController: ModalController,
	): Promise<void> {
		const modal = await modalController.create({
			component: PrivacyPolicyModalComponent,
		});
		return modal.present();
	}

	public static async termsOfService(
		modalController: ModalController,
	): Promise<void> {
		const modal = await modalController.create({
			component: TermsOfServiceModalComponent,
		});
		return modal.present();
	}
}
