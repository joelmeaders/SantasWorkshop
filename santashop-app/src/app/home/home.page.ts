import {
	ChangeDetectionStrategy,
	Component,
	inject,
	OnDestroy,
} from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { config } from '../../config';

import { LanguageToggleComponent } from '../shared/components/language-toggle/language-toggle.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonNote,
	IonSpinner,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonInput,
	IonItem,
	IonList,
	IonText,
	LoadingController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoFacebook, logoInstagram } from 'ionicons/icons';
import {
	AppStateService,
	AuthService,
	ErrorHandlerService,
	newAuthForm,
} from '@santashop/core';
import { AsyncPipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Auth, IError } from '@santashop/models';
import { map, shareReplay, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AsyncPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonNote,
		IonSpinner,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonInput,
		IonItem,
		IonList,
		IonText,
		LanguageToggleComponent,
		RouterLink,
		ReactiveFormsModule,
		TranslateModule,
	],
})
export class HomePage implements OnDestroy {
	private readonly appState = inject(AppStateService);
	private readonly authService = inject(AuthService);
	private readonly errorHandler = inject(ErrorHandlerService);
	private readonly loadingController = inject(LoadingController);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly destroy$ = new Subject<void>();
	private readonly resetEmailSent = new BehaviorSubject<boolean>(false);

	public readonly environmentName = `${config.name}_${config.label}`;
	public readonly environmentVersion = config.version;

	public readonly createAccountEnabled$ = this.appState.createAccountEnabled$;
	public readonly signInForm = newAuthForm();
	public readonly resetEmail = new FormControl('', {
		nonNullable: true,
		validators: [Validators.required, Validators.email],
	});
	public readonly resetEmailSent$ = this.resetEmailSent.asObservable();
	public readonly mode$ = this.route.queryParamMap.pipe(
		map((params) => {
			const mode = params.get('mode');
			return mode === 'sign-in' || mode === 'reset' ? mode : 'choose';
		}),
		takeUntil(this.destroy$),
		shareReplay(1),
	);

	constructor() {
		addIcons({ logoFacebook, logoInstagram });
	}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async onSignIn(): Promise<void> {
		if (this.signInForm.invalid) return;

		const loader = await this.loadingController.create({
			message: 'Signing in...',
		});
		await loader.present();

		try {
			await this.authService.login(this.signInForm.getRawValue() as Auth);
			const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
			const returnUrl = requestedUrl?.startsWith('/pre-registration/')
				? requestedUrl
				: '/pre-registration/overview';
			await this.router.navigateByUrl(returnUrl);
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		} finally {
			await loader.dismiss();
		}
	}

	public async resetPassword(): Promise<void> {
		if (this.resetEmail.invalid) return;
		try {
			await this.authService.resetPassword(this.resetEmail.value);
			this.resetEmailSent.next(true);
		} catch (error) {
			await this.errorHandler.handleError(error as IError);
		}
	}

	public resetPasswordForm(): void {
		this.resetEmail.reset();
		this.resetEmailSent.next(false);
	}
}
