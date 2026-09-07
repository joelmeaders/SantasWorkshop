import { EventDatePipe } from '@santashop/core/admin';
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
import {
	AlertController,
	LoadingController,
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
	IonText,
	IonSelect,
	IonSelectOption,
} from '@ionic/angular/standalone';
import {
	firstValueFrom,
	map,
	Observable,
} from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
	Child,
	COLLECTION_SCHEMA,
	DateTimeSlot,
	Registration,
} from '@santashop/models';
import { ReferralModalComponent } from '../../../shared/components/referral-modal/referral-modal.component';
import {
	FireRepoLite,
	FunctionsWrapper,
	dateToCalendarString,
	IFireRepoCollection,
	timestampToDate,
	HttpsCallableResult,
	PROGRAM_YEAR,
} from '@santashop/core/admin/firestore';
import { SearchService } from '../search/search.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { ManageChildrenComponent } from '../../../shared/components/manage-children/manage-children.component';
import { addIcons } from 'ionicons';
import { searchOutline, checkmarkCircle } from 'ionicons/icons';
import { QueryConstraint, where } from 'firebase/firestore';

@Component({
	selector: 'admin-pre-registration',
	templateUrl: './pre-registration.page.html',
	styleUrls: ['./pre-registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		HeaderComponent,
		ReactiveFormsModule,
		ManageChildrenComponent,
		EventDatePipe,
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
		IonText,
		IonSelect,
		IonSelectOption,
	],
})
export class PreRegistrationPage {
	private readonly modalController = inject(ModalController);
	private readonly fireRepo = inject(FireRepoLite);
	private readonly searchService = inject(SearchService);
	private readonly functions = inject(FunctionsWrapper);
	private readonly loadingController = inject(LoadingController);
	private readonly alertController = inject(AlertController);
	private readonly programYear = inject(PROGRAM_YEAR);

	public readonly children = signal<Child[]>([]);
	public readonly chosenReferrer = signal('None Selected');

	private readonly preRegistrationFn = (
		registration: Registration,
	): Promise<HttpsCallableResult<number>> =>
		this.functions.callableWrapper<Registration, number>(
			'callableAdminPreRegister',
		)(registration);

	public readonly form = new UntypedFormGroup({
		preferredLanguage: new UntypedFormControl('en', { nonNullable: true }),
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
		referredBy: new UntypedFormControl(
			undefined,
			Validators.compose([
				Validators.required,
				Validators.minLength(4),
				Validators.maxLength(50),
			]),
		),
		newsletter: new UntypedFormControl(false),
		dateTimeSlot: new UntypedFormControl(undefined, Validators.required),
	});

	public readonly availableSlots = toSignal(
		this.availableSlotsQuery(this.programYear).pipe(
		map((data) =>
			data.map((s) => {
				s.dateTime = timestampToDate(s.dateTime);
				return s;
			}),
		),
		map((data) =>
			data
				.slice()
				.sort((a, b) => a.dateTime.valueOf() - b.dateTime.valueOf()),
		),
		),
		{ initialValue: undefined },
	);

	constructor() {
		addIcons({ searchOutline, checkmarkCircle });
	}

	public ionViewWillLeave(): void {
		this.reset();
	}

	public async removeChild(childId: number): Promise<void> {
		const children = this.children()
			.filter((e) => e.id !== childId);
		this.children.set(children);
	}

	public async editChild(child: Child): Promise<void> {
		const children = this.children()
			.filter((e) => e.id !== child.id);

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
			this.form.controls['referredBy'].setValue(result.data);
			this.chosenReferrer.set(result.data);
		}
	}

	private dateTimeSlotCollection(): IFireRepoCollection<DateTimeSlot> {
		return this.fireRepo.collection<DateTimeSlot>(
			COLLECTION_SCHEMA.dateTimeSlots,
		);
	}

	/**
	 * Returns all time slots for the specified program year
	 * where the field 'enabled' is true.
	 *
	 * @private
	 * @param programYear
	 * @return
	 * @memberof DateTimePageService
	 */
	private availableSlotsQuery(
		programYear: number,
	): Observable<DateTimeSlot[]> {
		const queryConstraints: QueryConstraint[] = [
			where('programYear', '==', programYear),
			where('enabled', '==', true),
		];

		return this.dateTimeSlotCollection().readMany(queryConstraints, 'id');
	}

	public slotIndex(_: number, slot: DateTimeSlot): string {
		return slot.id ?? '';
	}

	public async register(): Promise<void> {
		const customerExists = await this.checkIfCustomerExists();
		if (customerExists) return;

		const loading = await this.loadingController.create({
			message: 'Please wait...',
		});

		await loading.present();

		try {
			const registration = {
				...this.form.value,
				children: this.children().map((child) => ({
					...child,
					dateOfBirth: new Date(
						`${dateToCalendarString(child.dateOfBirth)}T00:00:00.000Z`,
					),
				})),
			} as Registration;

			await this.preRegistrationFn(registration);
		} catch (error: unknown) {
			const err = error as { message?: string };
			const alert = await this.alertController.create({
				header: 'Error registering',
				subHeader:
					'Something went wrong and this customer was not registered.',
				message: err?.message ?? String(error),
			});

			await alert.present();
			return;
		} finally {
			await loading.dismiss();
		}

		this.reset();

		const alert = await this.alertController.create({
			header: 'Registration Complete',
			subHeader: 'A confirmation email has been queued for the customer.',
			message: 'You can now register another customer.',
			buttons: ['OK'],
		});

		await alert.present();
	}

	public async checkIfCustomerExists(): Promise<boolean> {
		// Set up search query
		const email = this.form.value.emailAddress;
		const results = await firstValueFrom(
			this.searchService.searchUsersByEmailAddress(email),
		);

		// If no results, return false
		if (results.length === 0) return false;

		// If results, alert user and return true
		const alert = await this.alertController.create({
			header: 'Error registering',
			subHeader: 'This customer already has an account.',
			message:
				'You cannot create another account with this email address',
			buttons: ['OK'],
		});

		await alert.present();

		return true;
	}

	public reset(): void {
		this.children.set([]);
		this.chosenReferrer.set('None Selected');
		this.form.reset();
	}
}
