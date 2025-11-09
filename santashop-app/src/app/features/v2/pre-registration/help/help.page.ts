import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PreRegistrationService } from '../../../../core';

import { AsyncPipe } from '@angular/common';
import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
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
	IonCard,
	IonCardHeader,
	IonItem,
	IonCardTitle,
	IonCardContent,
	IonText,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-help',
	templateUrl: './help.page.html',
	styleUrls: ['./help.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		AsyncPipe,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonCard,
		IonCardHeader,
		IonItem,
		IonCardTitle,
		IonCardContent,
		IonText,
	],
})
export class HelpPage {
	public readonly viewService = inject(PreRegistrationService);

	public readonly isRegistrationComplete$ =
		this.viewService.registrationComplete$;

	constructor() {
		addIcons({ arrowBackSharp });
	}
}
