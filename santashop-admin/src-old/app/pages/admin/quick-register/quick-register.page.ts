import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AlertController, LoadingController } from '@ionic/angular';
import {
	AgeGroup,
	Child,
	IError,
	Registration,
	ToyType,
} from '../../../../../../santashop-models/src/public-api';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import {
	takeUntil,
	publishReplay,
	refCount,
	map,
	take,
	filter,
	switchMap,
} from 'rxjs/operators';
import { QuickRegistrationForms } from 'santashop-admin/src/app/forms/quick-registration';
import { CheckInHelpers } from 'santashop-admin/src/app/helpers/checkin-helpers';
import { CheckInService } from 'santashop-admin/src/app/services/check-in.service';
import { RegistrationContextService } from '../../../services/registration-context.service';

@Component({
	selector: 'app-register',
	templateUrl: 'quick-register.page.html',
	styleUrls: ['quick-register.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickRegisterPage implements OnDestroy {
	public readonly customerForm: FormGroup =
		QuickRegistrationForms.customerForm(undefined);
	public readonly customerFormValidationMessages =
		QuickRegistrationForms.customerValidationMessages();

	public readonly childForm: FormGroup =
		QuickRegistrationForms.childForm(undefined);
	public readonly childFormValidationMessages =
		QuickRegistrationForms.childValidationMessages();

	public readonly $error = new Subject<IError>();
	private readonly $destroy = new Subject<void>();

	private readonly loading = new BehaviorSubject<boolean>(false);
	public readonly $loading = this.loading.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	private readonly zipCode = new BehaviorSubject<number | undefined>(
		undefined
	);
	public readonly $zipCode = this.zipCode.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	private readonly children = new BehaviorSubject<Partial<Child>[]>([]);
	public readonly $children = this.children.pipe(
		takeUntil(this.$destroy),
		publishReplay(1),
		refCount()
	);

	public readonly $canCheckIn = combineLatest([
		this.$zipCode,
		this.$children,
	]).pipe(
		takeUntil(this.$destroy),
		map(([zip, children]) => !!zip && !!children?.length),
		publishReplay(1),
		refCount()
	);

	private readonly isEdit = new BehaviorSubject<boolean>(false);

	public readonly registrationEditSubscription =
		this.registrationContext.registration$
			.pipe(
				takeUntil(this.$destroy),
				filter((response) => !!response),
				switchMap((registration) =>
					this.initRegistrationEdit(registration)
				)
			)
			.subscribe();

	constructor(
		private readonly loadingController: LoadingController,
		private readonly registrationContext: RegistrationContextService,
		public readonly checkInService: CheckInService,
		private readonly alertController: AlertController
	) {}

	public async initRegistrationEdit(
		registration?: Registration
	): Promise<void> {
		if (!registration) return;

		this.customerForm.get('zipCode')?.setValue(registration.zipCode);
		this.zipCode.next(registration.zipCode);
		this.children.next(registration.children!);
		this.isEdit.next(true);
	}

	public async checkIn(): Promise<void> {
		if (this.zipCode.getValue()?.toString().length !== 5) {
			await this.invalidZipAlert();
			return;
		}

		const registration = await this.createRegistration();

		try {
			await this.checkInService.checkIn(
				registration,
				this.isEdit.getValue()
			);
		} catch {
			// TODO: Error handling
		} finally {
			this.reset();
			this.registrationContext.reset();
		}
	}

	public async ngOnDestroy(): Promise<void> {
		this.$destroy.next();
		try {
			await this.loadingController.dismiss();
		} catch {
			// Do nothing
		}
	}

	public reset(): void {
		this.zipCode.next(undefined);
		this.children.next(new Array<Child>());
		this.registrationContext.reset();
		this.customerForm.reset();
		this.childForm.reset();
		this.isEdit.next(false);
	}

	public deleteChild(index: number): void {
		const current = this.children.getValue();
		current.splice(index, 1);
		this.children.next(CheckInHelpers.sortChildren(current));
	}

	public setZip($event: any): void {
		if (
			!$event.detail?.value ||
			$event.detail.value.toString().length !== 5
		) {
			return;
		}

		const value = Number.parseInt($event.detail.value, 5);
		this.zipCode.next(value);
	}

	public async addChild(): Promise<void> {
		if (!(await this.infantAgeGroupValid())) {
			return;
		}

		const current = this.children.getValue();
		const childValue = this.childForm.value as Child;
		const newChild: Partial<Child> = {
			ageGroup: childValue.ageGroup,
			toyType: childValue.toyType,
		};

		current.push(newChild);
		this.children.next(CheckInHelpers.sortChildren(current));
		this.childForm.reset();
	}

	public async infantAgeGroupValid(): Promise<boolean> {
		const ageGroup = this.childForm.get('ageGroup')?.value as AgeGroup;
		const toyType = this.childForm.get('toyType')?.value as ToyType;
		const invalidSelection =
			toyType === ToyType.infant && ageGroup !== AgeGroup.age02;

		if (!invalidSelection) {
			return true;
		}

		const alert = await this.alertController.create({
			header: 'Invalid Selection',
			message:
				'You can only choose <strong>Infant</strong> with the age group <strong>0-2</strong>. Change this and try again.',
			buttons: ['OK'],
		});

		await alert.present();
		await alert.onDidDismiss();
		return false;
	}

	public childColor = (value: ToyType): string | undefined =>
		CheckInHelpers.childColor(value);

	public onAgeChange($event: any): void {
		const value = $event.detail.value as AgeGroup;

		if (value === AgeGroup.age02) {
			this.childForm.get('toyType')?.setValue(ToyType.infant);
		}
	}

	private async createRegistration(): Promise<Registration> {
		let registration: Registration | undefined =
			await this.registrationContext.registration$
				.pipe(take(1))
				.toPromise();

		if (!registration) registration = {} as Registration;

		const children = CheckInHelpers.sortChildren(this.children.getValue());

		registration.zipCode = this.zipCode.getValue();
		registration.children = children as any[] as Child[];

		return registration;
	}

	private async invalidZipAlert(): Promise<any> {
		const alert = await this.alertController.create({
			header: 'Invalid Zip Code',
			message: 'Must be 5 digits long',
			buttons: [
				{
					text: 'Ok',
				},
			],
		});

		await alert.present();

		return alert.onDidDismiss();
	}
}
