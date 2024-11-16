import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, shareReplay } from 'rxjs/operators';
import { ProfilePageService } from '../profile.page.service';

import { PreRegistrationMenuComponent } from '../../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
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
	selector: 'app-change-email',
	templateUrl: './change-email.page.html',
	styleUrls: ['./change-email.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ProfilePageService],
	standalone: true,
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		ReactiveFormsModule,
		AsyncPipe,
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
export class ChangeEmailPage {
	public readonly form = this.viewService.changeEmailForm;

	public readonly email$ = this.viewService.userProfile$.pipe(
		map((profile) => profile.emailAddress),
		shareReplay(1),
	);

	constructor(private readonly viewService: ProfilePageService) {
		addIcons({ arrowBackSharp });
	}

	public changeEmail(): void {
		this.viewService.changeEmailAddress();
	}
}
