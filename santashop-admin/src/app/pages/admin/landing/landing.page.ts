import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService, AppStateService } from '@santashop/core/admin/firestore';

import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import {
	bagCheckOutline,
	documentTextOutline,
	searchOutline,
	storefrontOutline,
	personAddOutline,
	mailOutline,
	statsChartOutline,
	cartOutline,
	peopleOutline,
	exitOutline,
	moonOutline,
	calendarOutline,
	shieldCheckmarkOutline,
	alertCircleOutline,
} from 'ionicons/icons';
import {
	IonRouterLink,
	IonContent,
	IonList,
	IonListHeader,
	IonItem,
	IonIcon,
	IonToggle,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-landing',
	templateUrl: './landing.page.html',
	styleUrls: ['./landing.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterLink,
		IonRouterLink,
		IonContent,
		IonList,
		IonListHeader,
		IonItem,
		IonIcon,
		IonToggle,
		IonRouterLink,
		IonContent,
	],
})
export class LandingPage {
	private readonly authService = inject(AuthService);

	protected readonly appStateService = inject(AppStateService);

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

	public readonly isAdmin = toSignal(this.authService.isAdmin$, {
		initialValue: false,
	});
	public readonly isOwner = toSignal(this.authService.isOwner$, {
		initialValue: false,
	});

	public async signOut(): Promise<void> {
		await this.authService.logout();
		window.location.reload();
	}

	public toggleTheme(): void {
		this.appStateService.prefersDark = !this.appStateService.prefersDark;
		document.body.classList.toggle(
			'dark',
			this.appStateService.prefersDark,
		);
	}

	constructor() {
		addIcons({
			bagCheckOutline,
			searchOutline,
			storefrontOutline,
			personAddOutline,
			mailOutline,
			documentTextOutline,
			statsChartOutline,
			cartOutline,
			peopleOutline,
			exitOutline,
			moonOutline,
			calendarOutline,
			shieldCheckmarkOutline,
			alertCircleOutline,
		});
	}
}
