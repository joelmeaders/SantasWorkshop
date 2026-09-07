import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AppUpdatePromptComponent } from '@santashop/core/admin';

@Component({
	selector: 'admin-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonApp, IonRouterOutlet, AppUpdatePromptComponent],
})
export class AppComponent {
	constructor() {
		document.body.classList.toggle(
			'dark',
			globalThis.matchMedia('(prefers-color-scheme: dark)').matches,
		);
	}
}
