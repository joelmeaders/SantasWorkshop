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
import { AdminNavigationComponent } from './shared/components/navigation/admin-navigation.component';

@Component({
	selector: 'admin-session',
	imports: [IonRouterOutlet, AdminNavigationComponent],
	providers: [CheckInContextService],
	template:
		'@if (sessionActive()) { <aside><admin-navigation /></aside><div class="workspace"><ion-router-outlet /></div> }',
	styles: `
		:host {
			display: flex;
			flex-direction: row;
			height: 100%;
		}
		aside {
			display: none;
		}
		.workspace {
			position: relative;
			flex: 1;
			min-width: 0;
		}
		@media (min-width: 1024px) {
			aside {
				display: block;
				width: 248px;
				flex: 0 0 248px;
			}
		}
	`,
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
