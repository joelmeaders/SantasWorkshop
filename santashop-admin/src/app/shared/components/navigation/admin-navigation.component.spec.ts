import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppStateService, AuthService } from '@santashop/core/admin/firestore';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminLanguageService } from '../../preferences/admin-language.service';
import { AdminNavigationComponent } from './admin-navigation.component';

describe('AdminNavigationComponent', () => {
	it('lets check-in staff log out from the bottom of the sidebar', async () => {
		const logout = vi.fn().mockResolvedValue(undefined);
		await TestBed.configureTestingModule({
			imports: [AdminNavigationComponent],
			providers: [
				provideRouter([]),
				{
					provide: AuthService,
					useValue: {
						isAdmin$: of(false),
						isOwner$: of(false),
						logout,
					},
				},
				{
					provide: AppStateService,
					useValue: {
						checkinEnabled$: of(true),
						onsiteRegistrationEnabled$: of(false),
						preRegistrationEnabled$: of(false),
					},
				},
				{
					provide: AdminLanguageService,
					useValue: { text: (key: string) => key },
				},
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(AdminNavigationComponent);
		fixture.detectChanges();
		const sidebar: HTMLElement = fixture.nativeElement;
		const button = sidebar.querySelector<HTMLButtonElement>(
			'.account-actions button',
		);
		expect(sidebar.lastElementChild?.contains(button)).toBe(true);
		expect(button?.textContent?.trim()).toBe('Log out');
		button?.click();
		expect(logout).toHaveBeenCalledOnce();
	});
});
