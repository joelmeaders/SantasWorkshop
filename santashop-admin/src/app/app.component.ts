import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';

@Component({
	selector: 'app-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
})
export class AppComponent {
	constructor(private readonly platform: Platform) {
		this.initializeApp();
	}

	public initializeApp(): void {
		this.platform.ready().then(() => {});
	}
}
