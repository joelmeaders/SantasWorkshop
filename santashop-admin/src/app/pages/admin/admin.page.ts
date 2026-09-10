import { CheckInContextService } from '../../shared/services/check-in-context.service';
import {
	ChangeDetectionStrategy,
	Component,
	signal,
	inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AppStateService, AuthService } from '@santashop/core/admin/firestore';

import { Router, RouterLinkActive, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, pairwise } from 'rxjs';
import { addIcons } from 'ionicons';
import {
	storefrontOutline,
	bagCheckOutline,
	searchOutline,
} from 'ionicons/icons';
import {
	IonRouterLink,
	IonRouterOutlet,
	IonFooter,
	IonToolbar,
	IonTabBar,
	IonTabButton,
	IonIcon,
	IonLabel,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-admin',
	providers: [CheckInContextService],
	templateUrl: './admin.page.html',
	styleUrls: ['./admin.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterLinkActive,
		RouterLink,
		IonRouterLink,
		IonRouterOutlet,
		IonFooter,
		IonToolbar,
		IonTabBar,
		IonTabButton,
		IonIcon,
		IonLabel,
	],
})
export class AdminPage {
	private readonly appStateService = inject(AppStateService);
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);
	public readonly sessionActive = signal(true);

	public readonly isAdmin = toSignal(this.authService.isAdmin$, {
		initialValue: false,
	});

	public readonly preRegistrationEnabled = toSignal(
		this.appStateService.preRegistrationEnabled$,
		{ initialValue: false },
	);
	public readonly onsiteRegistrationEnabled = toSignal(
		this.appStateService.onsiteRegistrationEnabled$,
		{ initialValue: false },
	);
	public readonly checkinEnabled = toSignal(
		this.appStateService.checkinEnabled$,
		{ initialValue: false },
	);

	constructor() {
		this.authService.currentUser$
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
		addIcons({ storefrontOutline, bagCheckOutline, searchOutline });
	}
}
