import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppStateService } from './shared/services/app-state.service';

@Component({
	selector: 'admin-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
	private readonly appStateService = inject(AppStateService);

	constructor() {
		document.body.classList.toggle('dark', this.appStateService.prefersDark);
	}
}
