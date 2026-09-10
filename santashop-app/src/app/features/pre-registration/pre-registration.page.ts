import {
	ChangeDetectionStrategy,
	Component,
	signal,
	inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core';
import { distinctUntilChanged, map, pairwise } from 'rxjs';
import { InternalHeaderComponent } from '../../shared/components/internal-header/internal-header.component';
import { IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
	selector: 'app-pre-registration',
	templateUrl: './pre-registration.page.html',
	styleUrls: ['./pre-registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [InternalHeaderComponent, IonRouterOutlet],
})
export class PreRegistrationPage {
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);
	public readonly sessionActive = signal(true);
	constructor() {
		this.auth.currentUser$
			.pipe(
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
