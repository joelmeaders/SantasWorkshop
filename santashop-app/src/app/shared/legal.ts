import { ModalController } from '@ionic/angular';
import { PrivacyPolicyModalComponent } from './components/privacy-policy-modal/privacy-policy-modal.component';
import { TermsOfServiceModalComponent } from './components/terms-of-service-modal/terms-of-service-modal.component';

export abstract class LegalHelpers {
  public static async privacyPolicy(modalController: ModalController) {
    const modal = await modalController.create({
      component: PrivacyPolicyModalComponent,
    });
    return await modal.present();
  }

  public static async termsOfService(modalController: ModalController) {
    const modal = await modalController.create({
      component: TermsOfServiceModalComponent,
    });
    return await modal.present();
  }
}
