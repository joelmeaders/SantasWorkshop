import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
	PopoverController,
	ModalController,
	IonLabel,
	IonContent,
	IonList,
	IonItem,
} from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { shareReplay, takeUntil } from 'rxjs/operators';
import { AnalyticsWrapper, AuthService } from '@santashop/core/customer';
import { AsyncPipe } from '@angular/common';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { HelpPage } from '../../../features/v2/pre-registration/help/help.page';

@Component({
	selector: 'app-public-menu',
	templateUrl: './public-menu.component.html',
	styleUrls: ['./public-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonContent,
		IonList,
		IonItem,
		IonLabel,
		LanguageToggleComponent,
		AsyncPipe,
		TranslateModule,
		IonContent,
		IonList,
		IonItem,
		IonLabel,
	],
})
export class PublicMenuComponent implements OnDestroy {
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);
	private readonly popoverController = inject(PopoverController);
	private readonly modalController = inject(ModalController);
	private readonly translateService = inject(TranslateService);
	private readonly analyticsService = inject(AnalyticsWrapper);

	private readonly destroy$ = new Subject<void>();

	public readonly isLoggedIn$ = this.authService.currentUser$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1),
	);

	public ngOnDestroy(): void {
		this.destroy$.next();
	}

	public async closeMenu(): Promise<void> {
		await this.popoverController.dismiss();
	}

	public async home(): Promise<void> {
		await this.router.navigate(['/']);
		await this.closeMenu();
	}

	public async profile(): Promise<void> {
		await this.router.navigate(['/pre-registration/profile']);
		await this.closeMenu();
	}

	public async signIn(): Promise<void> {
		await this.router.navigate(['/'], { queryParams: { mode: 'sign-in' } });
		await this.closeMenu();
	}

	public async help(): Promise<void> {
		await this.closeMenu();
		const modal = await this.modalController.create({
			component: HelpPage,
			initialBreakpoint: 0.85,
			breakpoints: [0, 0.5, 0.85, 1],
		});
		await modal.present();
	}

	public async logout(): Promise<void> {
		await this.authService.logout();
		await this.closeMenu();
		location.reload();
	}

	public async setLanguage(value: 'en' | 'es'): Promise<void> {
		this.translateService.use(value);
		window.localStorage.setItem('santashop-language', value);
		this.analyticsService.logEvent(`set_language_${value}`);
		await this.closeMenu();
	}
}
