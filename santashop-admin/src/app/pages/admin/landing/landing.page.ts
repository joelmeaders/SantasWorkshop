import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@santashop/core';
import { AppStateService } from '../../../shared/services/app-state.service';

@Component({
	selector: 'admin-landing',
	templateUrl: './landing.page.html',
	styleUrls: ['./landing.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {

	private readonly authService = inject(AuthService);
	
	private readonly appStateService = inject(AppStateService);

	public prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

	constructor() {
		document.body.classList.toggle('dark', this.prefersDark);
	}

	public readonly preRegistrationEnabled$ = this.appStateService.preRegistrationEnabled$;

	public readonly onsiteRegistrationEnabled$ = this.appStateService.onsiteRegistrationEnabled$;
	
	public readonly checkinEnabled$ = this.appStateService.checkinEnabled$;

	public async signOut(): Promise<void> {
		await this.authService.logout();
		window.location.reload();
	}

	public toggleTheme(): void {
		this.prefersDark = !this.prefersDark;
		document.body.classList.toggle('dark', this.prefersDark);
	}
}
