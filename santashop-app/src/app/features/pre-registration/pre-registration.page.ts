import {
	ChangeDetectionStrategy,
	Component,
	Injector,
	signal,
	inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core';
import { SHOPPER_ACCESS_WATCH } from './shopper-access-watch';
import { ShopperAccessService } from '../../core/services/shopper-access.service';
import { EMPTY, distinctUntilChanged, map, pairwise, switchMap } from 'rxjs';
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
	private readonly watchAccess = inject(SHOPPER_ACCESS_WATCH, {
		optional: true,
	});
	private readonly injector = inject(Injector);
	public readonly sessionActive = signal(true);
	constructor() {
		this.auth.currentUser$
			.pipe(
				map((user) => user?.uid),
				distinctUntilChanged(),
				switchMap((uid) =>
					uid && this.watchAccess
						? this.watchAccess().pipe(
								map((status) => ({ uid, status })),
							)
						: EMPTY,
				),
				takeUntilDestroyed(),
			)
			.subscribe(({ uid, status }) => {
				this.sessionActive.set(false);
				void this.injector
					.get(ShopperAccessService)
					.handleLiveRestriction(uid, status)
					.then((disabled) => {
						if (!disabled) this.sessionActive.set(true);
					})
					.catch((error: unknown) =>
						console.error(
							'Could not show the shopper access notice.',
							error,
						),
					);
			});
		this.auth.currentUser$
			.pipe(
				map((user) => ({
					uid: user?.uid,
					recovery: this.auth.emailChangeRecovery,
				})),
				distinctUntilChanged(
					(a, b) => a.uid === b.uid && a.recovery === b.recovery,
				),
				pairwise(),
				takeUntilDestroyed(),
			)
			.subscribe(([previous, current]) => {
				if (current.recovery && current.recovery.uid === current.uid) {
					this.sessionActive.set(true);
					return;
				}
				if (previous.uid === current.uid) return;
				this.sessionActive.set(false);
				void this.router.navigateByUrl('/', { replaceUrl: true });
			});
	}
}
