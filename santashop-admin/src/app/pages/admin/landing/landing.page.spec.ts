import {
	beforeEach,
	describe,
	expect,
	it,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppStateService, AuthService } from '@santashop/core';
import { BehaviorSubject, of } from 'rxjs';
import { LandingPage } from './landing.page';

describe('LandingPage', () => {
	let component: LandingPage;
	let fixture: ComponentFixture<LandingPage>;
	let adminSubject: BehaviorSubject<boolean>;
	let ownerSubject: BehaviorSubject<boolean>;
	let authService: Mocked<AuthService> & {
		isAdmin$: BehaviorSubject<boolean>;
		isOwner$: BehaviorSubject<boolean>;
	};
	let appStateService: Pick<
		AppStateService,
		| 'preRegistrationEnabled$'
		| 'onsiteRegistrationEnabled$'
		| 'checkinEnabled$'
		| 'prefersDark'
	>;

	beforeEach(async () => {
		adminSubject = new BehaviorSubject<boolean>(true);
		ownerSubject = new BehaviorSubject<boolean>(true);
		authService = {
			logout: vi.fn().mockName('AuthService.logout'),
		} as unknown as Mocked<AuthService> & {
			isAdmin$: typeof adminSubject;
			isOwner$: typeof ownerSubject;
		};
		authService.isAdmin$ = adminSubject;
		authService.isOwner$ = ownerSubject;
		appStateService = {
			preRegistrationEnabled$: of(true),
			onsiteRegistrationEnabled$: of(true),
			checkinEnabled$: of(true),
			prefersDark: false,
		};

		TestBed.configureTestingModule({
			imports: [LandingPage],
			providers: [
				provideRouter([]),
				{ provide: AuthService, useValue: authService },
				{ provide: AppStateService, useValue: appStateService },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(LandingPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should show the schedule editor link for admin users', async () => {
		// Act
		await fixture.whenStable();
		await fixture.whenStable();
		await fixture.whenStable();

		// Assert
		expect(fixture.nativeElement.textContent).toContain(
			'Schedule & Capacity Editor',
		);

		const scheduleEditorItem = Array.from<HTMLElement>(
			fixture.nativeElement.querySelectorAll(
				'ion-item',
			) as NodeListOf<HTMLElement>,
		).find((element) =>
			element.textContent?.includes('Schedule & Capacity Editor'),
		) as HTMLElement | undefined;

		expect(scheduleEditorItem).toBeDefined();
		expect(
			scheduleEditorItem?.getAttribute('ng-reflect-router-link') ??
				scheduleEditorItem?.getAttribute('routerlink'),
		).toContain('../schedule-editor');
	});

	it('should hide the schedule editor link for non-admin users', async () => {
		// Arrange
		adminSubject.next(false);

		// Act
		await fixture.whenStable();
		await fixture.whenStable();
		await fixture.whenStable();

		// Assert
		expect(fixture.nativeElement.textContent).not.toContain(
			'Schedule & Capacity Editor',
		);
	});

	it('should show owner operations only to owners', async () => {
		expect(fixture.nativeElement.textContent).toContain('Owner Operations');

		ownerSubject.next(false);
		await fixture.whenStable();
		await fixture.whenStable();
		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).not.toContain(
			'Owner Operations',
		);
	});

	it('toggles the document theme using the persisted preference', () => {
		expect(document.body.classList.contains('dark')).toBe(false);

		component.toggleTheme();
		expect(appStateService.prefersDark).toBe(true);
		expect(document.body.classList.contains('dark')).toBe(true);

		component.toggleTheme();
		expect(appStateService.prefersDark).toBe(false);
		expect(document.body.classList.contains('dark')).toBe(false);
	});
});
