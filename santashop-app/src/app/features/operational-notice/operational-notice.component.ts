import {
	ChangeDetectionStrategy,
	Component,
	Input,
	inject,
	signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppStateService,
	AuthService,
	newAuthForm,
} from '@santashop/core/customer';
import { ReactiveFormsModule } from '@angular/forms';
import { defaultWaitingListSettings } from '@santashop/models';
import { of } from 'rxjs';
import { WaitingListComponent } from '../waiting-list/waiting-list.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonButton, IonContent, IonIcon,
	IonInput,
	IonItem,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoFacebook, logoInstagram } from 'ionicons/icons';
import { map } from 'rxjs/operators';

export type OperationalNoticeMode =
	'maintenance'
	| 'weather'
	| 'registration-closed';

@Component({
	selector: 'app-operational-notice',
	templateUrl: './operational-notice.component.html',
	styleUrls: ['./operational-notice.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslateModule, IonButton, IonContent, IonIcon,
		IonInput,
		IonItem,
		ReactiveFormsModule,
		WaitingListComponent,
	],
})
export class OperationalNoticeComponent {
	private readonly appState = inject(AppStateService);
	private readonly translate = inject(TranslateService);
	private readonly auth = inject(AuthService);
	public readonly user = toSignal(this.auth.currentUser$, {
		initialValue: null,
	});
	public readonly waitingListSettings = toSignal(
		this.appState.waitingListSettings$ ?? of(defaultWaitingListSettings()),
		{ initialValue: defaultWaitingListSettings() },
	);
	public readonly signInForm = newAuthForm();
	public readonly manageMembership =
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('waitingList') === 'manage';
	public readonly showSignIn = signal(false);
	public readonly signingIn = signal(false);
	public readonly signInError = signal(false);
	public readonly resetError = signal(false);
	public readonly resetSent = signal(false);
	public async signIn(): Promise<void> {
		if (this.signInForm.invalid || this.signingIn()) return;
		this.signingIn.set(true);
		this.signInError.set(false);
		try {
			const value = this.signInForm.getRawValue();
			await this.auth.login({
				emailAddress: value.emailAddress ?? '',
				password: value.password ?? '',
			});
		} catch {
			this.signInError.set(true);
		} finally {
			this.signingIn.set(false);
		}
	}
	public async resetPassword(): Promise<void> {
		this.resetError.set(false);
		this.resetSent.set(false);
		const email = this.signInForm.controls.emailAddress;
		if (email.invalid || this.signingIn()) return;
		this.signingIn.set(true);
		this.signInError.set(false);
		try {
			await this.auth.resetPassword(email.value ?? '');
			this.resetSent.set(true);
		} catch {
			this.resetError.set(true);
		} finally {
			this.signingIn.set(false);
		}
	}

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
	public readonly message = toSignal(this.appState.messageDoc$.pipe(
		map((doc) => {
			const message =
				this.translate.getCurrentLang() === 'en'
					? doc.messageEn
					: doc.messageEs;
			return message?.length ? message : null;
		}),
	), { initialValue: null });

	constructor() {
		addIcons({ logoFacebook, logoInstagram });
	}
}
