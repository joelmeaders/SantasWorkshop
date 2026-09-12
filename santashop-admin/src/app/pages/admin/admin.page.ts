import { AdminTextPipe } from '../../shared/preferences/admin-text.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppStateService, AuthService } from '@santashop/core/admin/firestore';

import { RouterLinkActive, RouterLink } from '@angular/router';
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
	templateUrl: './admin.page.html',
	styleUrls: ['./admin.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
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
		addIcons({ storefrontOutline, bagCheckOutline, searchOutline });
	}
}
