import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfilePageService } from './profile.page.service';

import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { NiceFormErrorPipe } from '@santashop/core';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowBackSharp } from 'ionicons/icons';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonItem,
	IonList,
	IonInput,
	IonIcon,
	IonLabel,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-profile',
	templateUrl: './profile.page.html',
	styleUrls: ['./profile.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterLink,
		ReactiveFormsModule,
		NiceFormErrorPipe,
		AsyncPipe,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonLabel,
		IonItem,
		IonList,
		IonInput,
	],
})
export class ProfilePage {
	private readonly viewService = inject(ProfilePageService);

	public readonly profileForm = this.viewService.profileForm;

	public readonly changeEmailForm = this.viewService.changeEmailForm;

	public readonly changePasswordForm = this.viewService.changePasswordForm;

	public readonly userProfile$ = this.viewService.userProfile$;
	public readonly updateProfile = (): Promise<void> =>
		this.viewService.updatePublicProfile();

	public readonly changeEmailAddress = (): Promise<void> =>
		this.viewService.changeEmailAddress();

	public readonly changePassword = (): Promise<void> =>
		this.viewService.changePassword();

	constructor() {
		addIcons({ arrowBackSharp });
	}
}
