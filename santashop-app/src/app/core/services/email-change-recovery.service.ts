import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core';

@Injectable({ providedIn: 'root' })
export class EmailChangeRecoveryService {
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);

	public async recover(error: unknown): Promise<boolean> {
		const recovery = this.auth.emailChangeRecovery;
		if (
			!recovery ||
			(error as { emailChangeRecovery?: unknown })
				?.emailChangeRecovery !== recovery
		)
			return false;
		await this.router.navigateByUrl('/pre-registration/profile', {
			replaceUrl: true,
			onSameUrlNavigation: 'reload',
		});
		return this.auth.emailChangeRecovery === recovery;
	}
}
