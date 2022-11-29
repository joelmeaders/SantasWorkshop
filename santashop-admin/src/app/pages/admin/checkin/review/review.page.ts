import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { Child } from '@models/*';
import { firstValueFrom } from 'rxjs';
import { AddEditChildModalComponent } from '../../../../shared/components/add-edit-child-modal/add-edit-child-modal.component';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../../shared/services/check-in.service';

@Component({
	selector: 'admin-review',
	templateUrl: './review.page.html',
	styleUrls: ['./review.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
	public wasEdited = false;

	public readonly registration$ = this.checkinContext.currentRegistration$;

	constructor(
		private readonly checkinContext: CheckInContextService,
		private readonly checkinService: CheckInService,
		private readonly modalController: ModalController,
		private readonly alertController: AlertController,
		private readonly router: Router
	) {}

	public async ionViewDidEnter(): Promise<void> {
		this.wasEdited = false;
	}

	public ionViewWillLeave(): void {
		this.checkinContext.resetRegistration();
		this.wasEdited = false;
	}

	public async removeChild(childId: number): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		const child = registration.children?.find((e) => e.id === childId);
		if (!child) return;

		const alert = await this.alertController.create({
			header: 'Are you sure?',
			subHeader: `${child.firstName} ${child.lastName}`,
			message: 'This child will be deleted',
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: '',
				},
				{
					text: 'OK',
					role: 'confirm',
					cssClass: '',
				},
			],
		});

		await alert.present();

		const result = await alert.onDidDismiss();

		if (result.role === 'cancel') return;

		registration.children = registration.children?.filter(
			(e) => e.id !== childId
		);
		this.checkinContext.setRegistration(registration);
		this.wasEdited = true;
	}

	public async addEditChild(child?: Child): Promise<void> {
		const modal = await this.modalController.create({
			component: AddEditChildModalComponent,
			componentProps: {
				child,
			},
		});

		await modal.present();
		const result = await modal.onDidDismiss();
		if (!result.data || result.role === 'cancelled') return;

		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		if (result.role === 'edit') {
			registration.children = registration.children?.filter(
				(e) => e.id !== result.data.id
			);
		}

		registration?.children?.push(result.data);
		this.checkinContext.setRegistration(registration);
	}

	public async checkIn(): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		try {
			const result: number = await this.checkinService.checkIn(
				registration,
				this.wasEdited
			);

			console.log(result);

			this.checkinContext.setCheckIn(
				result,
				registration.qrcode ?? 'nocode'
			);
			this.router.navigate(['admin/checkin/confirmation']);
		} catch (error: any) {
			console.log(JSON.stringify(error));

			if (error.code === 'functions/already-exists') {
				this.checkinContext.reset();
				this.router.navigate([
					'admin/checkin/duplicate',
					registration.uid,
				]);
				return;
			}

			const alert = await this.alertController.create({
				header: 'Error checking in',
				subHeader: `code: ${registration.qrcode}`,
				message: error?.message ?? error,
			});

			await alert.present();
			this.checkinContext.reset();
			await alert.onDidDismiss();
			await this.router.navigate(['admin/checkin/scan']);
		}
	}
}
