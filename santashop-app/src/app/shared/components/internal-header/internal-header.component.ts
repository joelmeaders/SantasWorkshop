import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@core/*';
import { PopoverController } from '@ionic/angular';
import { PublicMenuComponent } from '../public-menu/public-menu.component';

@Component({
	selector: 'app-internal-header',
	templateUrl: './internal-header.component.html',
	styleUrls: ['./internal-header.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InternalHeaderComponent {
	public readonly user$ = this.authService.currentUser$;

	constructor(
		private readonly authService: AuthService,
		private readonly popoverController: PopoverController
	) {}

	public async menu($event: any): Promise<void> {
		const popover = await this.popoverController.create({
			component: PublicMenuComponent,
			event: $event,
			translucent: true,
		});
		await popover.present();
	}
}
