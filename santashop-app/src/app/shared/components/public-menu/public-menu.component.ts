import { CustomerLanguageService } from '../../../core/services/customer-language.service';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
	PopoverController,
	ModalController,
	IonLabel,
	IonContent,
	IonList,
	IonItem,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '@santashop/core/customer';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { HelpPage } from '../../../features/pre-registration/help/help.page';

@Component({
	selector: 'app-public-menu',
	templateUrl: './public-menu.component.html',
	styleUrls: ['./public-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		IonContent,
		IonList,
		IonItem,
		IonLabel,
		LanguageToggleComponent,
		TranslateModule,
		IonContent,
		IonList,
		IonItem,
		IonLabel,
	],
})
export class PublicMenuComponent {
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);
	private readonly popoverController = inject(PopoverController);
	private readonly modalController = inject(ModalController);
	private readonly language = inject(CustomerLanguageService);

	public readonly isLoggedIn = toSignal(this.authService.currentUser$, {
		initialValue: null,
	});

	public async closeMenu(): Promise<void> {
		await this.popoverController.dismiss();
	}

	public async home(): Promise<void> {
		await this.router.navigate(['/']);
		await this.closeMenu();
	}

	public async profile(): Promise<void> {
		await this.router.navigate(['/pre-registration/profile']);
		await this.closeMenu();
	}

	public async signIn(): Promise<void> {
		await this.router.navigate(['/'], { queryParams: { mode: 'sign-in' } });
		await this.closeMenu();
	}

	public async help(): Promise<void> {
		await this.closeMenu();
		const modal = await this.modalController.create({
			component: HelpPage,
			initialBreakpoint: 0.85,
			breakpoints: [0, 0.5, 0.85, 1],
		});
		await modal.present();
	}

	public async logout(): Promise<void> {
		await this.authService.logout();
		await this.closeMenu();
		location.reload();
	}

	public async setLanguage(value: 'en' | 'es'): Promise<void> {
		await this.language.setLanguage(value);
		await this.closeMenu();
	}
}
