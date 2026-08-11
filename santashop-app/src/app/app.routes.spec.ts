import { TestBed } from '@angular/core/testing';
import { Router, type CanActivateFn, type CanMatchFn } from '@angular/router';
import { AuthService } from '@santashop/core/customer';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';

describe('customer routes', () => {
	let currentUser$: Observable<unknown>;
	const createUrlTree = vi.fn().mockName('Router.createUrlTree');
	const getCurrentNavigation = vi.fn();

	beforeEach((): void => {
		currentUser$ = of(null);
		createUrlTree.mockReset().mockReturnValue({ redirected: true });
		getCurrentNavigation.mockReset().mockReturnValue(null);
		TestBed.configureTestingModule({
			providers: [
				{
					provide: AuthService,
					useFactory: (): Partial<AuthService> => ({
						get currentUser$(): Observable<unknown> { return currentUser$; },
					} as Partial<AuthService>),
				},
				{
					provide: Router,
					useValue: { createUrlTree, getCurrentNavigation },
				},
			],
		});
	});

	it('keeps authenticated registration routes behind one lazy route group', (): void => {
		expect(routes.map((route) => route.path)).toEqual(['', 'sign-up', 'pre-registration', '**']);
		const preRegistration = routes.find((route) => route.path === 'pre-registration')!;
		expect(preRegistration.canMatch).toHaveLength(1);
		expect(preRegistration.children).toBeUndefined();
		expect(preRegistration.loadComponent).toBeUndefined();
		expect(preRegistration.loadChildren).toEqual(expect.any(Function));
	});

	it('redirects anonymous visitors to sign-in with their requested return URL', async (): Promise<void> => {
		getCurrentNavigation.mockReturnValue({
			extractedUrl: { toString: () => '/pre-registration/profile?tab=contact' },
		});
		const guard = routes.find((route) => route.path === 'pre-registration')!
			.canMatch![0] as CanMatchFn;
		const result = TestBed.runInInjectionContext(() =>
			guard(
				{} as never,
				[{ path: 'pre-registration' }, { path: 'profile' }] as never,
				{} as never,
			),
		);

		await expect(firstValueFrom(result as Observable<unknown>)).resolves.toEqual({ redirected: true });
		expect(createUrlTree).toHaveBeenCalledWith(['/'], {
			queryParams: {
				mode: 'sign-in',
				returnUrl: '/pre-registration/profile?tab=contact',
			},
		});
	});

	it('allows anonymous visitors into public routes and redirects signed-in visitors', async (): Promise<void> => {
		const guard = routes[0].canActivate![0] as CanActivateFn;
		const anonymous = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
		await expect(firstValueFrom(anonymous as Observable<unknown>)).resolves.toBe(true);

		currentUser$ = of({ uid: 'customer-1' });
		const signedIn = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
		await expect(firstValueFrom(signedIn as Observable<unknown>)).resolves.toEqual({ redirected: true });
		expect(createUrlTree).toHaveBeenCalledWith(['/pre-registration/overview']);
	});
});
