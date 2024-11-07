import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '../../../core';
import { CoreModule } from '@santashop/core';
import { NgIf, AsyncPipe } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from "ionicons";
import { home, accessibility, calendarOutline, sendOutline } from "ionicons/icons";
import { IonTabBar, IonTabButton, IonIcon, IonLabel } from "@ionic/angular/standalone";

@Component({
    selector: 'app-pre-registration-menu',
    templateUrl: './pre-registration-menu.component.html',
    styleUrls: ['./pre-registration-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [CoreModule, NgIf, AsyncPipe, TranslateModule, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class PreRegistrationMenuComponent {
    public readonly childCount$ = this.viewService.childCount$;

    public readonly chosenSlot$ = this.viewService.dateTimeSlot$;

    public readonly isRegistrationComplete$ =
        this.viewService.registrationComplete$;

    constructor(private readonly viewService: PreRegistrationService) {
        addIcons({ home, accessibility, calendarOutline, sendOutline });
    }
}
