import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SignInPageService } from './sign-in.page.service';

import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonCard,
	IonCardHeader,
	IonLabel,
	IonCardTitle,
	IonCardContent,
	IonIcon,
	IonList,
	IonItem,
	IonInput,
	IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';
import { AppStateService } from '@santashop/core';
import { AsyncPipe } from '@angular/common';

@Component({
	selector: 'app-sign-in',
	templateUrl: './sign-in.page.html',
	styleUrls: ['./sign-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [SignInPageService],
	imports: [
		AsyncPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonCard,
		IonCardHeader,
		IonLabel,
		IonCardTitle,
		IonCardContent,
		IonIcon,
		IonList,
		IonItem,
		IonInput,
		IonButton,
		RouterLink,
		ReactiveFormsModule,
		TranslateModule,
	],
})
export class SignInPage {
	private readonly viewService = inject(SignInPageService);
	private readonly appStateService = inject(AppStateService);

	public readonly form = this.viewService.form;

	public readonly createAccountEnabled$ =
		this.appStateService.createAccountEnabled$;

	constructor() {
		addIcons({ arrowBackSharp });
	}

	public onSignIn(): void {
		this.viewService.signIn();
	}
}
