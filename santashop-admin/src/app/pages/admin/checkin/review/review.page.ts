import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Child } from '@models/*';
import { firstValueFrom } from 'rxjs';
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

		registration.children = registration.children?.filter(
			(e) => e.id !== childId
		);
		this.checkinContext.setRegistration(registration);
		this.wasEdited = true;
	}

	public async editChild(child: Child): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		registration.children = registration.children?.filter(
			(e) => e.id !== child.id
		);

		registration?.children?.push(child);
		this.checkinContext.setRegistration(registration);
	}

	public async addChild(child: Child): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		registration?.children?.push(child);
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

			this.checkinContext.setCheckIn(
				result,
				registration.qrcode ?? 'nocode'
			);
			this.router.navigate(['admin/checkin/confirmation']);
		} catch (error: any) {
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
