import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStateService, CoreModule } from '@santashop/core';
import { AsyncPipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { logoFacebook, logoInstagram } from 'ionicons/icons';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { map } from 'rxjs/operators';

@Component({
	selector: 'app-bad-weather',
	templateUrl: './bad-weather.page.html',
	styleUrls: ['./bad-weather.page.css'],
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
export class BadWeatherPage {
	public readonly service = inject(AppStateService);
	private readonly translateService = inject(TranslateService);

	public readonly message$ = this.service.messageDoc$.pipe(
		map((doc) => {
			const message =
				this.translateService.currentLang === 'en'
					? doc.messageEn
					: doc.messageEs;
			return message?.length ? message : null;
		}),
	);

	constructor() {
		addIcons({ logoFacebook, logoInstagram });
	}
}
