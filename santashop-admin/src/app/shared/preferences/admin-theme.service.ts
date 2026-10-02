import { Injectable, signal, OnDestroy } from '@angular/core';

export type AdminTheme = 'system' | 'light' | 'dark';

export function readAdminPreference(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function saveAdminPreference(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* Keep the session preference when storage is blocked. */
	}
}

@Injectable({ providedIn: 'root' })
export class AdminThemeService implements OnDestroy {
	private readonly media = matchMedia('(prefers-color-scheme: dark)');
	public readonly theme = signal<AdminTheme>(this.savedTheme());
	public readonly dark = signal(false);
	private readonly followSystem = (): void => this.apply();

	constructor() {
		this.apply();
		this.media.addEventListener('change', this.followSystem);
	}

	public setTheme(theme: AdminTheme): void {
		this.theme.set(theme);
		saveAdminPreference('santashop-admin-theme', theme);
		this.apply();
	}

	private savedTheme(): AdminTheme {
		const saved = readAdminPreference('santashop-admin-theme');
		return saved === 'light' || saved === 'dark' ? saved : 'system';
	}

	private apply(): void {
		const dark =
			this.theme() === 'dark' ||
			(this.theme() === 'system' && this.media.matches);
		this.dark.set(dark);
		document.documentElement.dataset['adminTheme'] = dark
			? 'dark'
			: 'light';
		document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
		document.documentElement.style.backgroundColor = dark
			? '#292d30'
			: '#e9e9e6';
		document.body.classList.toggle('dark', dark);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', dark ? '#292d30' : '#e9e9e6');
	}

	public ngOnDestroy(): void {
		this.media.removeEventListener('change', this.followSystem);
	}
}
