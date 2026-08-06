import {
	ChangeDetectionStrategy,
	Component,
	Input,
	inject,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AppStateService } from '@santashop/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoFacebook, logoInstagram } from 'ionicons/icons';
import { map } from 'rxjs/operators';

export type OperationalNoticeMode =
	| 'maintenance'
	| 'weather'
	| 'registration-closed';

@Component({
	selector: 'app-operational-notice',
	templateUrl: './operational-notice.component.html',
	styleUrls: ['./operational-notice.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AsyncPipe, TranslateModule, IonButton, IonContent, IonIcon],
})
export class OperationalNoticeComponent {
	private readonly appState = inject(AppStateService);
	private readonly translate = inject(TranslateService);

	@Input({ required: true }) public mode!: OperationalNoticeMode;

	public get image(): string {
		switch (this.mode) {
			case 'maintenance':
				return 'assets/images/maintenance.png';
			case 'weather':
				return 'assets/images/bad-weather.png';
			default:
				return 'assets/images/registration-closed.png';
		}
	}
	public readonly message$ = this.appState.messageDoc$.pipe(
		map((doc) => {
			const message =
				this.translate.getCurrentLang() === 'en'
					? doc.messageEn
					: doc.messageEs;
			return message?.length ? message : null;
		}),
	);

	constructor() {
		addIcons({ logoFacebook, logoInstagram });
	}
}
