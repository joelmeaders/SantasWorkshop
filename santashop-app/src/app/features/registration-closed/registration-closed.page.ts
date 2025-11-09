import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

import { CoreModule } from '@santashop/core';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { logoFacebook, logoInstagram } from 'ionicons/icons';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';

@Component({
	selector: 'app-registration-closed',
	templateUrl: './registration-closed.page.html',
	styleUrls: ['./registration-closed.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CoreModule,
		AsyncPipe,
		TranslateModule,
		IonContent,
		IonButton,
		IonIcon,
	],
})
export class RegistrationClosedPage {
	public readonly service = inject(AppStateService);

	public readonly message$ = this.service.message$;

	constructor() {
		addIcons({ logoFacebook, logoInstagram });
	}
}
