import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DateTimeSlot } from '@santashop/models';
import { CoreModule, TimeSlotPipe } from '@santashop/core';

import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
	IonCard,
	IonCardHeader,
	IonItem,
	IonCardTitle,
	IonBadge,
	IonCardContent,
	IonButton,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-schedule-card',
	templateUrl: './schedule-card.component.html',
	styleUrls: ['./schedule-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CoreModule,
		RouterLink,
		DatePipe,
		TimeSlotPipe,
		TranslateModule,
		IonCard,
		IonCardHeader,
		IonItem,
		IonCardTitle,
		IonBadge,
		IonCardContent,
		IonButton,
	],
})
export class ScheduleCardComponent {
	public readonly dateTimeSlot = input<DateTimeSlot>();

	public readonly canChooseDateTime = input(false);
}
