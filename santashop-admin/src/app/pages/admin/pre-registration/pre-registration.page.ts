import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
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
    IonList,
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
    BehaviorSubject,
    firstValueFrom,
    map,
    Observable,
    shareReplay,
    Subject,
    takeUntil,
} from 'rxjs';
import {
    Child,
    COLLECTION_SCHEMA,
    DateTimeSlot,
    Registration,
} from '@santashop/models';
import { ReferralModalComponent } from '../../../shared/components/referral-modal/referral-modal.component';
import {
    FireRepoLite,
    IFireRepoCollection,
    timestampToDate,
    QueryConstraint,
    where,
    HttpsCallableResult,
} from '@santashop/core';
import { httpsCallable } from 'firebase/functions';
import { Functions } from '@angular/fire/functions';
import { SearchService } from '../search/search.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ManageChildrenComponent } from '../../../shared/components/manage-children/manage-children.component';
import { addIcons } from 'ionicons';
import { searchOutline, checkmarkCircle } from 'ionicons/icons';

@Component({
    selector: 'admin-pre-registration',
    templateUrl: './pre-registration.page.html',
    styleUrls: ['./pre-registration.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        HeaderComponent,
        ReactiveFormsModule,
        ManageChildrenComponent,
        AsyncPipe,
        DatePipe,
        IonContent,
        IonList,
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
        IonContent,
        IonList,
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
        IonSelectOption
    ],
})
export class PreRegistrationPage implements OnDestroy {
    private readonly modalController = inject(ModalController);
    private readonly fireRepo = inject(FireRepoLite);
    private readonly searchService = inject(SearchService);
    private readonly functions = inject(Functions);
    private readonly loadingController = inject(LoadingController);
    private readonly alertController = inject(AlertController);

    private readonly destroy$ = new Subject<void>();
    private readonly childrenList = new BehaviorSubject<Child[]>([]);
    public readonly children$ = this.childrenList.asObservable();

    private readonly referrer = new BehaviorSubject<string>('None Selected');
    public readonly chosenReferrer$ = this.referrer.asObservable();

    private readonly preRegistrationFn = (
        registration: Registration,
    ): Promise<HttpsCallableResult<number>> =>
        httpsCallable<Registration, number>(
            this.functions,
            'callableAdminPreRegister',
        )(registration);

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

    public readonly availableSlots$ = this.availableSlotsQuery(2024).pipe(
        takeUntil(this.destroy$),
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
        shareReplay(1),
    );

    constructor() {
        addIcons({ searchOutline, checkmarkCircle });
        addIcons({ searchOutline, checkmarkCircle });
    }

    public ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

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
            this.form.controls.referredBy.setValue(result.data);
            this.referrer.next(result.data);
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
        return slot.id!;
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
                children: this.childrenList.getValue(),
            } as Registration;

            await this.preRegistrationFn(registration);
        } catch (error: any) {
            const alert = await this.alertController.create({
                header: 'Error registering',
                subHeader:
                    'Something went wrong and this customer was not registered.',
                message: error?.message ?? error,
            });

            await alert.present();
        } finally {
            loading.dismiss();
        }

        this.reset();

        const alert = await this.alertController.create({
            header: 'Registration Complete',
            subHeader: 'An email has been sent to the customer.',
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
        this.childrenList.next([]);
        this.referrer.next('None Selected');
        this.form.reset();
    }
}
