import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from '@santashop/core/admin';
import { distinctUntilChanged, map, pairwise } from 'rxjs';
import { CheckInContextService } from './shared/services/check-in-context.service';

@Component({
	selector: 'admin-session',
	imports: [IonRouterOutlet],
	providers: [CheckInContextService],
	template: '@if (sessionActive()) { <ion-router-outlet /> }',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSessionComponent {
	public readonly sessionActive = signal(true);
	private readonly router = inject(Router);

	constructor() {
		inject(AuthService)
			.currentUser$.pipe(
				map((user) => user?.uid),
				distinctUntilChanged(),
				pairwise(),
				takeUntilDestroyed(),
			)
			.subscribe(() => {
				this.sessionActive.set(false);
				void this.router.navigateByUrl('/', { replaceUrl: true });
			});
	}
}
