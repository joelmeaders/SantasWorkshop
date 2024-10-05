import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { SkeletonStateService, CoreModule } from '@santashop/core';
import { AlertController, IonContent, IonGrid, IonRow, IonCol, IonButton, IonIcon, IonItem, IonCardTitle, IonCard, IonCardHeader, IonCardContent, IonLabel, IonText, IonListHeader, IonTitle, IonAccordionGroup, IonAccordion, IonList, IonNote } from '@ionic/angular/standalone';
import { DateTimeSlot } from '@santashop/models';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import {
    shareReplay,
    take,
    map,
    takeUntil,
    distinctUntilChanged,
    tap,
} from 'rxjs/operators';
import { DateTimePageService } from './date-time.page.service';
import { AppStateService } from '../../../../core';
import { RegistrationClosedPage } from '../../../registration-closed/registration-closed.page';
import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { NgIf, NgFor, AsyncPipe, DatePipe } from '@angular/common';
import { addIcons } from "ionicons";
import { arrowBackSharp } from "ionicons/icons";

@Component({
    selector: 'app-date-time',
    templateUrl: './date-time.page.html',
    styleUrls: ['./date-time.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [DateTimePageService],
    standalone: true,
    imports: [
        PreRegistrationMenuComponent,
        RouterLink,
        CoreModule,
        NgIf,
        NgFor,
        AsyncPipe,
        DatePipe,
        TranslateModule,
        IonContent,
        IonGrid,
        IonRow,
        IonCol,
        IonButton,
        IonIcon,
        IonItem,
        IonCardTitle,
        IonCard,
        IonCardHeader,
        IonCardContent,
        IonLabel,
        IonText,
        IonListHeader,
        IonTitle,
        IonAccordionGroup,
        IonAccordion,
        IonList,
        IonNote
    ],
})
export class DateTimePage implements OnDestroy {
    private readonly destroy$ = new Subject<void>();

    public readonly availableSlots$ = this.viewService.availableSlots$.pipe(
        takeUntil(this.destroy$),
        map((slots) => slots.filter((slot) => slot.enabled)),
        distinctUntilChanged(
            (prev, curr) => JSON.stringify(prev) === JSON.stringify(curr),
        ),
        shareReplay(1),
    );

    public readonly availableDays$ = this.availableSlots$.pipe(
        takeUntil(this.destroy$),
        map((slots) =>
            slots.map((slot) => Date.parse(slot.dateTime.toDateString())),
        ),
        map((dates) => [...new Set(dates)]),
        shareReplay(1),
    );

    public readonly availableSlotsByDay$ = (
        date: number,
    ): Observable<DateTimeSlot[]> =>
        this.availableSlots$.pipe(
            takeUntil(this.destroy$),
            map((slots) =>
                slots.filter(
                    (slot) => Date.parse(slot.dateTime.toDateString()) === date,
                ),
            ),
            shareReplay(1),
        );

    public readonly chosenSlot$ = this.viewService.registrationSlot$.pipe(
        takeUntil(this.destroy$),
        shareReplay(1),
    );

    protected readonly closedSubscription =
        this.appStateService.isRegistrationEnabled$
            .pipe(
                tap((enabled) => {
                    if (!enabled)
                        this.appStateService.setModal(RegistrationClosedPage);
                }),
            )
            .subscribe();

    constructor(
        private readonly viewService: DateTimePageService,
        private readonly alertController: AlertController,
        private readonly translateService: TranslateService,
        private readonly analytics: Analytics,
        public readonly skeletonState: SkeletonStateService,
        private readonly appStateService: AppStateService,
    ) {
        addIcons({ arrowBackSharp });
    }

    public ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public ionViewDidLeave(): void {
        this.skeletonState.removeStatesByGroup('dateTimePage');
    }

    public async selectDateTime(slot?: DateTimeSlot): Promise<void> {
        const hasSlot = await this.alreadyChoseSlot();
        let shouldChange = false;

        if (hasSlot) shouldChange = await this.confirmChangeDate();

        if (shouldChange) logEvent(this.analytics, 'cancelled_datetime');

        if (!hasSlot || shouldChange) {
            logEvent(this.analytics, 'chose_datetime');
            await this.viewService.updateRegistration(slot);
        }
    }

    public spotsRemaining(slot: DateTimeSlot): string {
        const slots = slot.maxSlots - (slot.slotsReserved ?? 0);

        if (!slot.enabled || slots <= 0) return 'Unavailable';

        return slots === 1 ? `${slots} spot` : `${slots} spots`;
    }

    private alreadyChoseSlot(): Promise<boolean> {
        const source = this.chosenSlot$.pipe(
            take(1),
            map((slot) => !!slot),
        );
        return firstValueFrom(source);
    }

    private async confirmChangeDate(): Promise<boolean> {
        const alert = await this.alertController.create({
            // TODO: This stuff
            header: this.translateService.instant('Confirm Changes'),
            subHeader: this.translateService.instant(
                'Are you sure you want to do this?',
            ),
            message: this.translateService.instant(
                'The slot you already have may no longer be available if you continue.',
            ),
            buttons: [
                {
                    text: 'Go Back',
                    role: 'cancel',
                },
                {
                    text: 'Continue',
                },
            ],
        });

        await alert.present();

        return alert.onDidDismiss().then((e) => e.role !== 'cancel');
    }
}
