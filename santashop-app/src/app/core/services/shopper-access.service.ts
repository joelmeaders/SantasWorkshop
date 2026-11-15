import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { AuthService, FunctionsWrapper } from '@santashop/core/customer';
import { firstValueFrom } from 'rxjs';

export interface ShopperAccessStatus {
	disabled: boolean;
	hasActiveRegistration: boolean;
}

@Injectable({ providedIn: 'root' })
export class ShopperAccessService {
	private readonly auth = inject(AuthService);
	private readonly functions = inject(FunctionsWrapper);
	private readonly modalController = inject(ModalController);
	private pendingNotice?: { uid: string; promise: Promise<void> };

	public async verify(uid: string): Promise<boolean> {
		const status = await this.readStatus();
		if (!(await this.isCurrentUser(uid))) return false;
		if (!status.disabled) return true;
		await this.showDisabledNotice(uid, status.hasActiveRegistration);
		return false;
	}

	public async handleLiveRestriction(
		uid: string,
		status: ShopperAccessStatus,
	): Promise<boolean> {
		if (!status.disabled || !(await this.isCurrentUser(uid))) return false;
		await this.showDisabledNotice(uid, status.hasActiveRegistration);
		return true;
	}

	private async readStatus(): Promise<ShopperAccessStatus> {
		const status = await this.functions.callableWrapper<
			undefined,
			ShopperAccessStatus
		>('getShopperAccessStatus')(undefined);
		return status.data;
	}

	private async isCurrentUser(uid: string): Promise<boolean> {
		return (await firstValueFrom(this.auth.currentUser$))?.uid === uid;
	}

	private async showDisabledNotice(
		uid: string,
		hasActiveRegistration: boolean,
	): Promise<void> {
		if (this.pendingNotice?.uid === uid) return this.pendingNotice.promise;
		const promise = this.presentAfterSignOut(uid, hasActiveRegistration);
		this.pendingNotice = { uid, promise };
		try {
			await promise;
		} finally {
			if (this.pendingNotice?.promise === promise)
				this.pendingNotice = undefined;
		}
	}

	private async presentAfterSignOut(
		uid: string,
		hasActiveRegistration: boolean,
	): Promise<void> {
		if (!(await this.isCurrentUser(uid))) return;
		await this.auth.logout(false);
		const { ShopperAccessDisabledComponent, SHOPPER_ACCESS_MODAL_ID } =
			await import('../../features/shopper-access/shopper-access-disabled.component');
		const modal = await this.modalController.create({
			id: SHOPPER_ACCESS_MODAL_ID,
			component: ShopperAccessDisabledComponent,
			componentProps: { hasActiveRegistration },
			backdropDismiss: false,
			htmlAttributes: { 'aria-labelledby': 'shopper-access-title' },
		});
		await modal.present();
	}
}
