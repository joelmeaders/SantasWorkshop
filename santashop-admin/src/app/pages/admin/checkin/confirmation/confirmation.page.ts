import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
	IonRouterLink,
	IonContent,
	IonText,
	IonButton,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-confirmation',
	templateUrl: './confirmation.page.html',
	styleUrls: ['./confirmation.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		HeaderComponent,
		RouterLink,
		AsyncPipe,
		IonRouterLink,
		IonContent,
		IonText,
		IonButton,
		IonRouterLink,
		IonContent,
		IonText,
		IonButton,
		IonRouterLink,
		IonContent,
		IonText,
		IonButton,
	],
})
export class ConfirmationPage {
	private readonly checkinContext = inject(CheckInContextService);

	public readonly checkin$ = this.checkinContext.checkin$;

	public ionViewWillLeave(): void {
		this.checkinContext.reset();
	}
}
