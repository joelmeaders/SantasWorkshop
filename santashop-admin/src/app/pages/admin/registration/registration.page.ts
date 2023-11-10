import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { Child, Registration } from '@santashop/models';
import { ReferralModalComponent } from '../../../shared/components/referral-modal/referral-modal.component';
import { CheckInContextService } from '../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../shared/services/check-in.service';

@Component({
	selector: 'admin-registration',
	templateUrl: './registration.page.html',
	styleUrls: ['./registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationPage {
	private readonly childrenList = new BehaviorSubject<Child[]>([]);
	public readonly children$ = this.childrenList.asObservable();

	private readonly referrer = new BehaviorSubject<string>('None Selected');
	public readonly chosenReferrer$ = this.referrer.asObservable();

	public readonly form = new UntypedFormGroup({
		firstName: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(2),
				Validators.maxLength(20),
			]),
		),
		lastName: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(2),
				Validators.maxLength(25),
			]),
		),
		emailAddress: new UntypedFormControl(
			undefined,
			Validators.compose([Validators.required, Validators.email]),
		),
		zipCode: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(5),
				Validators.maxLength(5),
			]),
		),
		referral: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(4),
				Validators.maxLength(50),
			]),
		),
		newsletter: new UntypedFormControl(false),
	});

	constructor(
		private readonly modalController: ModalController,
		private readonly checkinService: CheckInService,
		private readonly checkinContext: CheckInContextService,
		private readonly router: Router,
		private readonly alertController: AlertController,
	) {}

	public ionViewWillLeave(): void {
		this.reset();
	}

	public async removeChild(childId: number): Promise<void> {
		const children = this.childrenList
			.getValue()
			.filter((e) => e.id !== childId);
		this.childrenList.next(children);
	}

	public async editChild(child: Child): Promise<void> {
		const children = this.childrenList
			.getValue()
			.filter((e) => e.id !== child.id);

		children.push(child);
		this.childrenList.next(children);
	}

	public async addChild(child: Child): Promise<void> {
		const children = this.childrenList.getValue();
		children.push(child);
		this.childrenList.next(children);
	}

	public async chooseReferral(): Promise<void> {
		const modal = await this.modalController.create({
			component: ReferralModalComponent,
		});
		await modal.present();
		const result = await modal.onDidDismiss();
		if (result.data) {
			this.form.controls.referral.setValue(result.data);
			this.referrer.next(result.data);
		}
	}

	public async checkIn(): Promise<void> {
		const registration = {
			...this.form.value,
			children: this.childrenList.getValue(),
			uid: 'onsite',
			qrcode: 'onsite',
			dateTimeSlot: { id: 'onsite' },
		} as Registration;

		console.log(registration);

		try {
			const result: number =
				await this.checkinService.onSiteRegistration(registration);

			this.checkinContext.setCheckIn(
				result,
				registration.qrcode ?? 'onsite',
			);
			this.router.navigate(['admin/checkin/confirmation']);
		} catch (error: any) {
			console.log(error);
			if (error.details.code === 6) {
				this.checkinContext.reset();
				this.router.navigate([
					'admin/checkin/duplicate',
					registration.uid,
				]);
				return;
			}

			const alert = await this.alertController.create({
				header: 'Error registering',
				subHeader: `code: ${error.code}`,
				message: error?.message ?? error,
			});

			await alert.present();
			this.checkinContext.reset();
			await alert.onDidDismiss();
			await this.router.navigate(['/admin']);
		}
	}

	public reset(): void {
		this.childrenList.next([]);
		this.referrer.next('None Selected');
		this.form.reset();
	}
}
