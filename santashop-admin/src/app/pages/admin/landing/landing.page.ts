import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@santashop/core';

@Component({
	selector: 'admin-landing',
	templateUrl: './landing.page.html',
	styleUrls: ['./landing.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
	constructor(private readonly authService: AuthService) {}

	public async logout(): Promise<void> {
		await this.authService.logout();
	}

	public toggleTheme($event: any): void {
		document.body.classList.toggle('dark', $event.detail.checked);
	}
}
