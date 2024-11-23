import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

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
	IonTitle,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-header',
	templateUrl: './header.component.html',
	styleUrls: ['./header.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		RouterLink,
		IonRouterLink,
		IonHeader,
		IonToolbar,
		IonButtons,
		IonButton,
		IonIcon,
		IonTitle,
	],
})
export class HeaderComponent {
	@Input() public title?: string;

	@Input() public backRoute = '/admin';

	constructor() {
		addIcons({ arrowBackSharp });
		addIcons({ arrowBackSharp });
		addIcons({ arrowBackSharp });
	}
}
