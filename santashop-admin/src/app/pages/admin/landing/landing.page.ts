import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@santashop/core';

@Component({
	selector: 'admin-landing',
	templateUrl: './landing.page.html',
	styleUrls: ['./landing.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {

	public prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

	constructor(private readonly authService: AuthService) {
		document.body.classList.toggle('dark', this.prefersDark);
	}

	public async signOut(): Promise<void> {
		await this.authService.logout();
		window.location.reload();
	}

	public toggleTheme(): void {
		this.prefersDark = !this.prefersDark;
		document.body.classList.toggle('dark', this.prefersDark);
	}
}
