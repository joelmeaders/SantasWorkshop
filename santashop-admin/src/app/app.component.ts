import { AdminLanguageService } from './shared/preferences/admin-language.service';
import {
	Component,
	ChangeDetectionStrategy,
	computed,
	inject,
} from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import {
	AppUpdatePromptComponent,
	DEFAULT_APP_UPDATE_PROMPT_COPY,
} from '@santashop/core/admin';

@Component({
	selector: 'admin-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [IonApp, IonRouterOutlet, AppUpdatePromptComponent],
})
export class AppComponent {
	private readonly language = inject(AdminLanguageService);
	public readonly updateCopy = computed(() => ({
		readyTitle: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.readyTitle,
		),
		readyMessage: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.readyMessage,
		),
		failedTitle: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.failedTitle,
		),
		failedMessage: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.failedMessage,
		),
		unrecoverableTitle: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.unrecoverableTitle,
		),
		unrecoverableMessage: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.unrecoverableMessage,
		),
		reloadLabel: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.reloadLabel,
		),
		laterLabel: this.language.text(
			DEFAULT_APP_UPDATE_PROMPT_COPY.laterLabel,
		),
	}));
}
