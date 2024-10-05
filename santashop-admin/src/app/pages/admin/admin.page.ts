import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStateService } from '../../shared/services/app-state.service';

import { RouterLinkActive, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { addIcons } from "ionicons";
import { storefrontOutline, bagCheckOutline, searchOutline } from "ionicons/icons";
import { IonRouterLink, IonContent, IonRouterOutlet, IonFooter, IonToolbar, IonTabBar, IonTabButton, IonIcon, IonLabel } from "@ionic/angular/standalone";

@Component({
    selector: 'admin-admin',
    templateUrl: './admin.page.html',
    styleUrls: ['./admin.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterLinkActive, RouterLink, AsyncPipe, IonRouterLink, IonContent, IonRouterOutlet, IonFooter, IonToolbar, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class AdminPage {
    private readonly appStateService = inject(AppStateService);

    public readonly preRegistrationEnabled$ =
        this.appStateService.preRegistrationEnabled$;
    public readonly onsiteRegistrationEnabled$ =
        this.appStateService.onsiteRegistrationEnabled$;
    public readonly checkinEnabled$ = this.appStateService.checkinEnabled$;

    constructor() {
        addIcons({ storefrontOutline, bagCheckOutline, searchOutline });
    }
}
