import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { Child } from '../../../../../../dist/santashop-models';
import { ReferralModalComponent } from '../../../shared/components/referral-modal/referral-modal.component';

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
			])
		),
		lastName: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(2),
				Validators.maxLength(25),
			])
		),
		emailAddress: new UntypedFormControl(
			undefined,
			Validators.compose([Validators.required, Validators.email])
		),
		zipCode: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(5),
				Validators.maxLength(5),
			])
		),
		referral: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(4),
				Validators.maxLength(50),
			])
		),
		newsletter: new UntypedFormControl(false),
	});

	constructor(private readonly modalController: ModalController) {}

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

	public reset(): void {
		this.childrenList.next([]);
		this.referrer.next('None Selected');
		this.form.reset();
	}
}
