import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfilePageService } from '../profile.page.service';

import { PreRegistrationMenuComponent } from '../../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NiceFormErrorPipe } from '@santashop/core';
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
	IonCard,
	IonCardContent,
	IonList,
	IonInput,
	IonLabel,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-change-password',
	templateUrl: './change-password.page.html',
	styleUrls: ['./change-password.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ProfilePageService],
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		ReactiveFormsModule,
		TranslateModule,
		NiceFormErrorPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonItem,
		IonCardTitle,
		IonCard,
		IonCardContent,
		IonList,
		IonInput,
		IonLabel,
	],
})
export class ChangePasswordPage {
	private readonly viewService = inject(ProfilePageService);

	public readonly form = this.viewService.changePasswordForm;

	constructor() {
		addIcons({ arrowBackSharp });
	}

	public changePassword(): void {
		this.viewService.changePassword();
	}
}
