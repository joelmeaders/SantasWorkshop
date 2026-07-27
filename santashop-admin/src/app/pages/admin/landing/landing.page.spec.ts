import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppStateService, AuthService } from '@santashop/core';
import { UserEmailUid } from '@santashop/models';
import { BehaviorSubject, of } from 'rxjs';
import { LandingPage } from './landing.page';

describe('LandingPage', () => {
	let component: LandingPage;
	let fixture: ComponentFixture<LandingPage>;
	let emailSubject: BehaviorSubject<UserEmailUid>;
	let authService: jasmine.SpyObj<AuthService> & {
		emailAndUid$: BehaviorSubject<UserEmailUid>;
	};
	let appStateService: Pick<
		AppStateService,
		| 'preRegistrationEnabled$'
		| 'onsiteRegistrationEnabled$'
		| 'checkinEnabled$'
		| 'prefersDark'
	>;

	beforeEach(waitForAsync(() => {
		emailSubject = new BehaviorSubject<UserEmailUid>({
			emailAddress: 'admin@example.com',
			uid: '123',
		});
		authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout']) as jasmine.SpyObj<AuthService> & {
			emailAndUid$: typeof emailSubject;
		};
		authService.emailAndUid$ = emailSubject;
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
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should show the schedule editor link for admin users', async () => {
		// Act
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		// Assert
		expect(fixture.nativeElement.textContent).toContain(
			'Schedule & Capacity Editor',
		);

		const scheduleEditorItem = Array.from<HTMLElement>(
			fixture.nativeElement.querySelectorAll('ion-item') as NodeListOf<HTMLElement>,
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
		emailSubject.next({ emailAddress: 'helper@example.com', uid: '123' });

		// Act
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		// Assert
		expect(fixture.nativeElement.textContent).not.toContain(
			'Schedule & Capacity Editor',
		);
	});
});
