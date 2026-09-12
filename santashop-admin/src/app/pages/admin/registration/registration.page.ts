import { AdminLanguageService } from '../../../shared/preferences/admin-language.service';
import { createAdminAlert } from '../../../shared/preferences/admin-overlays';
import { AdminTextPipe } from '../../../shared/preferences/admin-text.pipe';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
	AlertController,
	ModalController,
	IonContent,
	IonListHeader,
	IonNote,
	IonItemDivider,
	IonLabel,
	IonItem,
	IonInput,
	IonCheckbox,
	IonButton,
	IonIcon,
} from '@ionic/angular/standalone';
import { Child, Registration } from '@santashop/models';
import { ReferralModalComponent } from '../../../shared/components/referral-modal/referral-modal.component';
import { CheckInContextService } from '../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../shared/services/check-in.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ManageChildrenComponent } from '../../../shared/components/manage-children/manage-children.component';
import { addIcons } from 'ionicons';
import { searchOutline, checkmarkCircle } from 'ionicons/icons';

@Component({
	selector: 'admin-registration',
	templateUrl: './registration.page.html',
	styleUrls: ['./registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		HeaderComponent,
		ReactiveFormsModule,
		ManageChildrenComponent,
		IonContent,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonInput,
		IonCheckbox,
		IonButton,
		IonIcon,
	],
})
export class RegistrationPage {
	public readonly language = inject(AdminLanguageService);
	private readonly modalController = inject(ModalController);
	private readonly checkinService = inject(CheckInService);
	private readonly checkinContext = inject(CheckInContextService);
	private readonly router = inject(Router);
	private readonly alertController = inject(AlertController);

	public readonly children = signal<Child[]>([]);
	public readonly chosenReferrer = signal('None Selected');

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
				Validators.pattern(/^\d{5}$/),
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

	constructor() {
		addIcons({ searchOutline, checkmarkCircle });
	}

	public ionViewWillLeave(): void {
		this.reset();
	}

	public async removeChild(childId: number): Promise<void> {
		const children = this.children().filter((e) => e.id !== childId);
		this.children.set(children);
	}

	public async editChild(child: Child): Promise<void> {
		const children = this.children().filter((e) => e.id !== child.id);

		children.push(child);
		this.children.set(children);
	}

	public async addChild(child: Child): Promise<void> {
		this.children.update((children) => [...children, child]);
	}

	public async chooseReferral(): Promise<void> {
		const modal = await this.modalController.create({
			component: ReferralModalComponent,
		});
		await modal.present();
		const result = await modal.onDidDismiss();
		if (result.data) {
			this.form.controls['referral'].setValue(result.data);
			this.chosenReferrer.set(result.data);
		}
	}

	public async checkIn(): Promise<void> {
		const registration = {
			...this.form.value,
			children: this.children(),
			uid: 'onsite',
			qrcode: 'onsite',
			dateTimeSlot: { id: 'onsite' },
		} as Registration;

		try {
			const result: number =
				await this.checkinService.onSiteRegistration(registration);

			this.checkinContext.setCheckIn(
				result,
				registration.qrcode ?? 'onsite',
			);
			this.router.navigate(['/admin/checkin/confirmation']);
		} catch (error: unknown) {
			const err = error as {
				details?: { code?: number };
				code?: string;
				message?: string;
			};
			if (err.details?.code === 6) {
				this.checkinContext.reset();
				this.router.navigate([
					'/admin/checkin/duplicate',
					registration.uid,
				]);
				return;
			}

			const alert = await createAdminAlert(this.alertController, () => ({
				header: 'Error registering',
				subHeader: this.language.text('code: {{v0}}', {
					v0: err.code ?? 'unknown',
				}),
				message: err?.message ?? String(error),
			}));

			await alert.present();
			this.checkinContext.reset();
			await alert.onDidDismiss();
			await this.router.navigate(['/admin']);
		}
	}

	public reset(): void {
		this.children.set([]);
		this.chosenReferrer.set('None Selected');
		this.form.reset();
	}
}
