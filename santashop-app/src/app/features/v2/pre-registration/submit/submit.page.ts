import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SubmitPageService } from './submit.page.service';

import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { TimeSlotPipe } from '@santashop/core';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
	arrowBackSharp,
	manOutline,
	womanOutline,
	happyOutline,
} from 'ionicons/icons';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonItem,
	IonCardTitle,
	IonCardHeader,
	IonCardSubtitle,
	IonLabel,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-submit',
	templateUrl: './submit.page.html',
	styleUrls: ['./submit.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [SubmitPageService],
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		AsyncPipe,
		DatePipe,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonItem,
		IonCardTitle,
		IonCardHeader,
		IonCardSubtitle,
		IonLabel,
		TimeSlotPipe,
	],
})
export class SubmitPage {
	public readonly viewService = inject(SubmitPageService);

	public readonly registrationReadyToSubmit$ =
		this.viewService.registrationReadyToSubmit$;

	constructor() {
		addIcons({ arrowBackSharp, manOutline, womanOutline, happyOutline });
	}

	public async submit(): Promise<void> {
		await this.viewService.submitRegistration();
	}
}
