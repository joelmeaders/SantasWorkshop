import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Router } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { shareReplay, takeUntil } from 'rxjs/operators';
import { AuthService } from '@core/*';

@Component({
	selector: 'app-public-menu',
	templateUrl: './public-menu.component.html',
	styleUrls: ['./public-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicMenuComponent implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly isLoggedIn$ = this.authService.currentUser$.pipe(
		takeUntil(this.destroy$),
		shareReplay(1)
	);

	constructor(
		private readonly authService: AuthService,
		private readonly router: Router,
		private readonly popoverController: PopoverController,
		private readonly translateService: TranslateService,
		private readonly analyticsService: Analytics
	) {}

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
		await this.router.navigate(['/sign-in']);
		await this.closeMenu();
	}

	public async help(): Promise<void> {
		await this.router.navigate(['/pre-registration/help']);
		await this.closeMenu();
	}

	public async createAccount(): Promise<void> {
		await this.router.navigate(['/sign-up-account']);
		await this.closeMenu();
	}

	public async logout(): Promise<void> {
		await this.authService.logout();
		await this.closeMenu();
		location.reload();
	}

	public async setLanguage(value: 'en' | 'es'): Promise<void> {
		this.translateService.use(value);
		await logEvent(this.analyticsService, `set_language_${value}`);
		await this.closeMenu();
	}
}
