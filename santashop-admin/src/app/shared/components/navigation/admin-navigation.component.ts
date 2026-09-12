import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppStateService, AuthService } from '@santashop/core/admin/firestore';
import { AdminTextPipe } from '../../preferences/admin-text.pipe';

@Component({
	selector: 'admin-navigation',
	imports: [RouterLink, RouterLinkActive, AdminTextPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nav [attr.aria-label]="'Main navigation' | adminText">
			<a class="brand" routerLink="/admin/landing">
				{{ 'Santa Shop' | adminText }}
				<span>{{ 'Staff workspace' | adminText }}</span></a
			>
			<a routerLink="/admin/landing" routerLinkActive="selected">{{
				'Home' | adminText
			}}</a>
			<a
				[routerLink]="checkinEnabled() ? '/admin/checkin/scan' : null"
				[attr.aria-disabled]="!checkinEnabled()"
				routerLinkActive="selected"
				>{{ 'Check-in' | adminText }}</a
			>
			<a routerLink="/admin/search" routerLinkActive="selected">{{
				'Search' | adminText
			}}</a>
			@if (isAdmin()) {
				<p>{{ 'Registration' | adminText }}</p>
				<a
					[routerLink]="
						onsiteEnabled() ? '/admin/registration' : null
					"
					[attr.aria-disabled]="!onsiteEnabled()"
					routerLinkActive="selected"
					>{{ 'On-Site Registration' | adminText }}</a
				>
				<a
					[routerLink]="
						preEnabled() ? '/admin/pre-registration' : null
					"
					[attr.aria-disabled]="!preEnabled()"
					routerLinkActive="selected"
					>{{ 'Pre-Register Customers' | adminText }}</a
				>
				<p>{{ 'Reports' | adminText }}</p>
				<a
					routerLink="/admin/stats/registration"
					routerLinkActive="selected"
					>{{ 'Registration Stats' | adminText }}</a
				>
				<a
					routerLink="/admin/stats/check-in"
					routerLinkActive="selected"
					>{{ 'Check-In Stats' | adminText }}</a
				>
				<a routerLink="/admin/stats/user" routerLinkActive="selected">{{
					'User Stats' | adminText
				}}</a>
				<a
					routerLink="/admin/stats/scan-risk"
					routerLinkActive="selected"
					>{{ 'Scan Risk Review' | adminText }}</a
				>
				<p>{{ 'Tools' | adminText }}</p>
				<a
					routerLink="/admin/resend-email"
					routerLinkActive="selected"
					>{{ 'Resend Registration Emails' | adminText }}</a
				>
				<a
					routerLink="/admin/schedule-editor"
					routerLinkActive="selected"
					>{{ 'Schedule & Capacity Editor' | adminText }}</a
				>
				<a
					routerLink="/admin/email-templates"
					routerLinkActive="selected"
					>{{ 'Email Templates' | adminText }}</a
				>
				<a routerLink="/admin/users" routerLinkActive="selected">{{
					'User Management' | adminText
				}}</a>
				@if (isOwner()) {
					<p>{{ 'Owner' | adminText }}</p>
					<a
						routerLink="/admin/app-settings"
						routerLinkActive="selected"
						>{{ 'App settings' | adminText }}</a
					>
					<a
						routerLink="/admin/owner-operations"
						routerLinkActive="selected"
						>{{ 'Owner Operations' | adminText }}</a
					>
				}
			}
		</nav>
	`,
	styles: `
		:host {
			display: block;
			height: 100%;
			overflow: auto;
			background: var(--admin-surface);
			border-right: 1px solid var(--admin-border);
		}
		nav {
			padding: 24px 16px;
		}
		a {
			display: block;
			min-height: 44px;
			padding: 12px;
			color: var(--ion-text-color);
			text-decoration: none;
			border-radius: 10px;
			font-size: 0.875rem;
			line-height: 1.4;
		}
		a.selected {
			color: var(--admin-accent);
			background: var(--admin-accent-soft);
			font-weight: 700;
		}
		a[aria-disabled='true'] {
			color: var(--admin-muted);
			cursor: not-allowed;
		}
		.brand {
			font-size: 1.35rem;
			font-weight: 750;
			margin-bottom: 24px;
		}
		.brand span {
			display: block;
			font-size: 0.75rem;
			color: var(--admin-muted);
			font-weight: 400;
			margin-top: 4px;
		}
		p {
			color: var(--admin-muted);
			font-size: 0.7rem;
			font-weight: 700;
			margin: 24px 12px 6px;
		}
	`,
})
export class AdminNavigationComponent {
	private readonly auth = inject(AuthService);
	private readonly settings = inject(AppStateService);
	public readonly isAdmin = toSignal(this.auth.isAdmin$, {
		initialValue: false,
	});
	public readonly isOwner = toSignal(this.auth.isOwner$, {
		initialValue: false,
	});
	public readonly checkinEnabled = toSignal(this.settings.checkinEnabled$, {
		initialValue: false,
	});
	public readonly onsiteEnabled = toSignal(
		this.settings.onsiteRegistrationEnabled$,
		{ initialValue: false },
	);
	public readonly preEnabled = toSignal(
		this.settings.preRegistrationEnabled$,
		{
			initialValue: false,
		},
	);
}
