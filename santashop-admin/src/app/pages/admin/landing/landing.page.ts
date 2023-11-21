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
	
	protected readonly appStateService = inject(AppStateService);

	public readonly preRegistrationEnabled$ = this.appStateService.preRegistrationEnabled$;

	public readonly onsiteRegistrationEnabled$ = this.appStateService.onsiteRegistrationEnabled$;
	
	public readonly checkinEnabled$ = this.appStateService.checkinEnabled$;

	public async signOut(): Promise<void> {
		await this.authService.logout();
		window.location.reload();
	}

	public toggleTheme(): void {
		this.appStateService.prefersDark = !this.appStateService.prefersDark;
		document.body.classList.toggle('dark', this.appStateService.prefersDark);
	}
}
