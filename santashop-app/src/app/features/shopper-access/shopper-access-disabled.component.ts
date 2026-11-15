import { ChangeDetectionStrategy, Component, inject, Input, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

export const SHOPPER_ACCESS_MODAL_ID = 'shopper-access-disabled';

@Component({
	selector: 'app-shopper-access-disabled',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonButton, IonContent, IonHeader, IonTitle, IonToolbar, TranslateModule],
	template: `
		<ion-header>
			<ion-toolbar>
				<ion-title id="shopper-access-title">{{ 'SHOPPER_ACCESS.TITLE' | translate }}</ion-title>
			</ion-toolbar>
		</ion-header>
		<ion-content class="ion-padding">
			<p>{{ 'SHOPPER_ACCESS.HELP' | translate }}</p>
			<p class="support-email">{{ supportEmail }}</p>
			@if (hasActiveRegistration) {
				<p>{{ 'SHOPPER_ACCESS.CANCELLATION' | translate }}</p>
			}
			<ion-button fill="outline" (click)="copyEmail()">{{ 'SHOPPER_ACCESS.COPY_EMAIL' | translate }}</ion-button>
			<ion-button color="xmasred" (click)="close()">{{ 'SHOPPER_ACCESS.CLOSE' | translate }}</ion-button>
			<p role="status">{{ (copyStatus() || '') | translate }}</p>
		</ion-content>
	`,
	styles: `
		:host { display: flex; height: 100%; flex-direction: column; }
		.support-email { user-select: all; overflow-wrap: anywhere; font-weight: 700; }
	`,
})
export class ShopperAccessDisabledComponent {
	private readonly modal = inject(ModalController);
	@Input() public hasActiveRegistration = false;
	public readonly supportEmail = 'president@denversantaclausshop.org';
	public readonly copyStatus = signal('');

	public async copyEmail(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.supportEmail);
			this.copyStatus.set('SHOPPER_ACCESS.COPIED');
		} catch {
			this.copyStatus.set('SHOPPER_ACCESS.COPY_FAILED');
		}
	}

	public async close(): Promise<void> {
		await this.modal.dismiss(undefined, 'close', SHOPPER_ACCESS_MODAL_ID);
	}
}
