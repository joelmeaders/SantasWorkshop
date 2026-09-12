import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService, AppStateService } from '@santashop/core/admin/firestore';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminSessionComponent } from './admin-session.component';
import { CheckInContextService } from './shared/services/check-in-context.service';

describe('AdminSessionComponent', () => {
	it.each([null, { uid: 'staff-b' }])(
		'ends the protected session on identity change to %j',
		async (nextUser) => {
			const currentUser$ = new BehaviorSubject<{ uid: string } | null>({
				uid: 'staff-a',
			});
			TestBed.configureTestingModule({
				imports: [AdminSessionComponent],
				providers: [
					provideRouter([]),
					{
						provide: AuthService,
						useValue: {
							currentUser$,
							isAdmin$: of(false),
							isOwner$: of(false),
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
				],
			});
			const navigate = vi
				.spyOn(TestBed.inject(Router), 'navigateByUrl')
				.mockResolvedValue(true);
			const fixture = TestBed.createComponent(AdminSessionComponent);
			await fixture.whenStable();
			const oldContext = fixture.debugElement.injector.get(
				CheckInContextService,
			);
			oldContext.setCheckIn(2, 'old-code');
			currentUser$.next({ uid: 'staff-a' });
			expect(fixture.componentInstance.sessionActive()).toBe(true);
			currentUser$.next(nextUser);
			expect(fixture.componentInstance.sessionActive()).toBe(false);
			expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
			await fixture.whenStable();
			expect(
				fixture.nativeElement.querySelector('ion-router-outlet'),
			).toBeNull();
			expect(await firstValueFrom(oldContext.checkin$)).toBeUndefined();
			fixture.destroy();

			currentUser$.next({ uid: 'staff-b' });
			const nextFixture = TestBed.createComponent(AdminSessionComponent);
			const nextContext = nextFixture.debugElement.injector.get(
				CheckInContextService,
			);
			oldContext.setCheckIn(2, 'late-old-code');
			expect(await firstValueFrom(nextContext.checkin$)).toBeUndefined();
			expect(nextFixture.componentInstance.sessionActive()).toBe(true);
		},
	);
});
