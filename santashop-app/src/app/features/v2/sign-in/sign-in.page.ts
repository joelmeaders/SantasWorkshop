import { ChangeDetectionStrategy, Component } from '@angular/core';
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

@Component({
	selector: 'app-sign-in',
	templateUrl: './sign-in.page.html',
	styleUrls: ['./sign-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [SignInPageService],
	standalone: true,
	imports: [
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
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonCard,
		IonCardHeader,
		IonButton,
		IonIcon,
		IonLabel,
		IonCardTitle,
		IonCardContent,
		IonList,
		IonItem,
		IonInput,
	],
})
export class SignInPage {
	public readonly form = this.viewService.form;

	constructor(private readonly viewService: SignInPageService) {
		addIcons({ arrowBackSharp });
	}

	public onSignIn(): void {
		this.viewService.signIn();
	}
}
