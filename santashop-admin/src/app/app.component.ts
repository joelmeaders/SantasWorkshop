import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { AppStateService } from '@santashop/core';

@Component({
	selector: 'admin-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
	private readonly appStateService = inject(AppStateService);

	constructor() {
		document.body.classList.toggle(
			'dark',
			this.appStateService.prefersDark,
		);
	}
}
