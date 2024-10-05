import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { NgIf, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonRouterLink, IonContent, IonText, IonButton } from "@ionic/angular/standalone";

@Component({
    selector: 'admin-confirmation',
    templateUrl: './confirmation.page.html',
    styleUrls: ['./confirmation.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [HeaderComponent, NgIf, RouterLink, AsyncPipe, IonRouterLink, IonContent, IonText, IonButton],
})
export class ConfirmationPage {
    public readonly checkin$ = this.checkinContext.checkin$;

    constructor(private readonly checkinContext: CheckInContextService) { }

    public ionViewWillLeave(): void {
        this.checkinContext.reset();
    }
}
