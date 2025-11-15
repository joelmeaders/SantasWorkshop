import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@santashop/core';
import {
	PopoverController,
	IonIcon,
	IonHeader,
	IonToolbar,
	IonItem,
	IonButton,
} from '@ionic/angular/standalone';
import { PublicMenuComponent } from '../public-menu/public-menu.component';
import { AsyncPipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { menuSharp } from 'ionicons/icons';

@Component({
	selector: 'app-internal-header',
	templateUrl: './internal-header.component.html',
	styleUrls: ['./internal-header.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonIcon,
		IonHeader,
		IonToolbar,
		IonItem,
		IonButton,
		AsyncPipe,
		IonHeader,
		IonToolbar,
		IonItem,
		IonButton,
		IonIcon,
	],
})
export class InternalHeaderComponent {
	private readonly authService = inject(AuthService);
	private readonly popoverController = inject(PopoverController);

	public readonly user$ = this.authService.currentUser$;

	constructor() {
		addIcons({ menuSharp });
	}

	public async menu($event: any): Promise<void> {
		const popover = await this.popoverController.create({
			component: PublicMenuComponent,
			event: $event,
			translucent: true,
		});
		await popover.present();
	}
}
