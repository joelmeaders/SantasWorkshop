import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import { PreRegistrationService } from '../../../core';
import { ProfileService } from '../../../core/services/profile.service';
import { CoreModule } from '@santashop/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { InternalHeaderComponent } from '../../../shared/components/internal-header/internal-header.component';

import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from "ionicons";
import { home, accessibility, calendarOutline, checkmark, sendOutline } from "ionicons/icons";
import { IonContent, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from "@ionic/angular/standalone";

@Component({
    selector: 'app-pre-registration',
    templateUrl: './pre-registration.page.html',
    styleUrls: ['./pre-registration.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CoreModule,
        NgIf,
        InternalHeaderComponent,

        AsyncPipe,
        TranslateModule,
        IonContent,
        IonTabs,
        IonTabBar,
        IonTabButton,
        IonIcon,
        IonLabel,
        IonBadge
    ],
})
export class PreRegistrationPage implements OnDestroy {
    private readonly destroy$ = new Subject<void>();

    public readonly referredBy$ = this.profileService.referredBy$.pipe(
        shareReplay(1),
    );

    public readonly userRegistration$ = this.viewService.userRegistration$.pipe(
        takeUntil(this.destroy$),
        shareReplay(1),
    );

    public readonly childCount$ = this.viewService.childCount$.pipe(
        takeUntil(this.destroy$),
        shareReplay(1),
    );

    public readonly chosenSlot$ = this.viewService.dateTimeSlot$.pipe(
        takeUntil(this.destroy$),
        shareReplay(1),
    );

    public readonly isRegistrationComplete$ =
        this.viewService.registrationComplete$.pipe(
            takeUntil(this.destroy$),
            shareReplay(1),
        );

    constructor(
        private readonly viewService: PreRegistrationService,
        private readonly profileService: ProfileService,
    ) {
        addIcons({ home, accessibility, calendarOutline, checkmark, sendOutline });
    }

    public ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
