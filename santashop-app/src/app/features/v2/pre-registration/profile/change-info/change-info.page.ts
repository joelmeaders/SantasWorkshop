import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProfilePageService } from '../profile.page.service';

import { PreRegistrationMenuComponent } from '../../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CoreModule } from '@santashop/core';
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
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-change-info',
	templateUrl: './change-info.page.html',
	styleUrls: ['./change-info.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ProfilePageService],
	standalone: true,
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		ReactiveFormsModule,
		TranslateModule,
		CoreModule,
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
	],
})
export class ChangeInfoPage {
	public readonly form = this.viewService.profileForm;

	constructor(private readonly viewService: ProfilePageService) {
		addIcons({ arrowBackSharp });
	}

	public updateProfile(): void {
		this.viewService.updatePublicProfile();
	}
}
