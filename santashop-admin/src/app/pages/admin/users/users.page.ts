import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import {
	AlertController,
	LoadingController,
	ModalController,
	IonContent,
	IonList,
	IonItem,
	IonLabel,
	IonButton,
	IonButtons,
	IonIcon,
	IonBadge,
	IonNote,
	IonFab,
	IonFabButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
	add,
	createOutline,
	keyOutline,
	trashOutline,
} from 'ionicons/icons';
import { StaffAccount, StaffRole, UpdateStaffUser } from '@santashop/models';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { StaffService } from './staff.service';
import { UserEditorComponent } from './user-editor.component';
import { AuthService } from '@santashop/core';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'admin-users',
	templateUrl: './users.page.html',
	styleUrls: ['./users.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AsyncPipe,
		HeaderComponent,
		IonContent,
		IonList,
		IonItem,
		IonLabel,
		IonButton,
		IonButtons,
		IonIcon,
		IonBadge,
		IonNote,
		IonFab,
		IonFabButton,
	],
})
export class UsersPage {
	private readonly staffService = inject(StaffService);
	private readonly modalController = inject(ModalController);
	private readonly alerts = inject(AlertController);
	private readonly loading = inject(LoadingController);
	private readonly authService = inject(AuthService);

	public readonly staffAccounts$ = this.staffService.staffAccounts$;
	public readonly isOwner$ = this.authService.isOwner$;

	private readonly roleLabels: Readonly<Record<StaffRole, string>> = {
		admin: 'Administrator',
		checkin: 'Check-In',
	};

	constructor() {
		addIcons({ add, createOutline, keyOutline, trashOutline });
	}

	public roleLabel(role: StaffRole): string {
		return this.roleLabels[role] ?? role;
	}

	public canManage(account: StaffAccount, isOwner: boolean): boolean {
		return isOwner || !account.roles.includes('admin');
	}

	public async addUser(): Promise<void> {
		await this.presentEditor();
	}

	public async editUser(account: StaffAccount): Promise<void> {
		await this.presentEditor(account);
	}

	public async resetPassword(account: StaffAccount): Promise<void> {
		let password = '';

		const alert = await this.alerts.create({
			header: 'Reset Password',
			message: `Set a new password for ${account.displayName}.`,
			inputs: [
				{
					name: 'password',
					type: 'password',
					placeholder: 'New password (min 8 characters)',
					attributes: { minlength: 8, autocomplete: 'new-password' },
				},
			],
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{
					text: 'Save',
					role: 'confirm',
					handler: (value: { password?: string }): boolean => {
						if (!value.password || value.password.length < 8) {
							return false;
						}

						password = value.password;
						return true;
					},
				},
			],
		});

		await alert.present();
		const result = await alert.onDidDismiss();

		if (result.role !== 'confirm' || password.length < 8) {
			return;
		}

		const update: UpdateStaffUser = {
			uid: account.uid,
			newPassword: password,
		};

		await this.runWithFeedback(
			() => this.staffService.updateStaffUser(update),
			'Updating password…',
			'Password updated.',
		);
	}

	public async deleteUser(account: StaffAccount): Promise<void> {
		const alert = await this.alerts.create({
			header: 'Delete User',
			message: `Delete ${account.displayName}? This cannot be undone.`,
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{ text: 'Delete', role: 'destructive' },
			],
		});

		await alert.present();
		const result = await alert.onDidDismiss();

		if (result.role !== 'destructive') {
			return;
		}

		await this.runWithFeedback(
			() => this.staffService.deleteStaffUser(account.uid),
			'Deleting user…',
			'User deleted.',
		);
	}

	private async presentEditor(account?: StaffAccount): Promise<void> {
		const isOwner = await firstValueFrom(this.isOwner$);
		if (account && !this.canManage(account, isOwner)) {
			await this.showAlert(
				'Owner access required',
				'Only a project owner may alter an administrator.',
			);
			return;
		}
		const modal = await this.modalController.create({
			component: UserEditorComponent,
			componentProps: { account, isOwner },
		});

		await modal.present();
		const result = await modal.onDidDismiss();

		if (result.role === 'create') {
			await this.runWithFeedback(
				() => this.staffService.createStaffUser(result.data),
				'Creating user…',
				'User created.',
			);
		} else if (result.role === 'update') {
			await this.runWithFeedback(
				() => this.staffService.updateStaffUser(result.data),
				'Saving changes…',
				'Changes saved.',
			);
		}
	}

	private async runWithFeedback(
		action: () => Promise<unknown>,
		loadingMessage: string,
		successMessage: string,
	): Promise<void> {
		const loading = await this.loading.create({
			message: loadingMessage,
			translucent: true,
			backdropDismiss: false,
		});
		await loading.present();

		try {
			await action();
			await this.dismissLoading();
			await this.showAlert('Success', successMessage);
		} catch (error) {
			await this.dismissLoading();
			const err = error as { details?: string; message?: string };
			await this.showAlert(
				'Something went wrong',
				err.details ?? err.message ?? 'Please try again.',
			);
		}
	}

	private async dismissLoading(): Promise<void> {
		if (await this.loading.getTop()) {
			await this.loading.dismiss();
		}
	}

	private async showAlert(header: string, message: string): Promise<void> {
		const alert = await this.alerts.create({
			header,
			message,
			buttons: ['OK'],
		});
		await alert.present();
	}
}
