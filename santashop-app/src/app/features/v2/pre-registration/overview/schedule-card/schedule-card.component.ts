import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DateTimeSlot } from '@santashop/models';
import { CoreModule } from '@santashop/core';

import { NgIf, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IonCard, IonCardHeader, IonItem, IonCardTitle, IonBadge, IonCardContent, IonButton } from "@ionic/angular/standalone";

@Component({
    selector: 'app-schedule-card',
    templateUrl: './schedule-card.component.html',
    styleUrls: ['./schedule-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [CoreModule, NgIf, RouterLink, DatePipe, TranslateModule, IonCard, IonCardHeader, IonItem, IonCardTitle, IonBadge, IonCardContent, IonButton],
})
export class ScheduleCardComponent {
    @Input() public dateTimeSlot?: DateTimeSlot;

    @Input() public canChooseDateTime = false;
}
