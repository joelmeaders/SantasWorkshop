import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonItem,
	IonCardTitle,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-event-information',
	templateUrl: './event-information.page.html',
	styleUrls: ['./event-information.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		RouterLink,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonItem,
		IonCardTitle,
	],
})
export class EventInformationPage {
	constructor() {
		addIcons({ arrowBackSharp });
	}
}
