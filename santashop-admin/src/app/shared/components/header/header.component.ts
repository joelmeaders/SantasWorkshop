import { AdminTextPipe } from '../../preferences/admin-text.pipe';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AdminPreferencesComponent } from '../../preferences/admin-preferences.component';

import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';
import {
	IonRouterLink,
	IonHeader,
	IonToolbar,
	IonButtons,
	IonButton,
	IonIcon,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-header',
	templateUrl: './header.component.html',
	styleUrls: ['./header.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		AdminPreferencesComponent,
		RouterLink,
		IonRouterLink,
		IonHeader,
		IonToolbar,
		IonButtons,
		IonButton,
		IonIcon,
	],
})
export class HeaderComponent {
	public readonly showBack = input(true);
	public readonly title = input<string>();

	public readonly backRoute = input('/admin');

	constructor() {
		addIcons({ arrowBackSharp });
	}
}
