import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

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
	imports: [
		AdminTextPipe,
		HeaderComponent,
		RouterLink,
		IonRouterLink,
		IonContent,
		IonText,
		IonButton,
		IonRouterLink,
	],
})
export class ConfirmationPage {
	private readonly checkinContext = inject(CheckInContextService);

	public readonly checkin = toSignal(this.checkinContext.checkin$, {
		initialValue: undefined,
	});

	public ionViewWillLeave(): void {
		this.checkinContext.reset();
	}
}
