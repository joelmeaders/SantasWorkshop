import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppStateService } from './shared/services/app-state.service';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
	selector: 'admin-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [IonApp, IonRouterOutlet, IonApp, IonRouterOutlet],
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
