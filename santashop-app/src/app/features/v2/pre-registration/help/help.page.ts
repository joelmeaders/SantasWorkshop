import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '../../../../core';

import { NgIf, AsyncPipe } from '@angular/common';
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
	standalone: true,
	imports: [
		NgIf,
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
	public readonly isRegistrationComplete$ =
		this.viewService.registrationComplete$;

	constructor(public readonly viewService: PreRegistrationService) {
		addIcons({ arrowBackSharp });
	}
}
