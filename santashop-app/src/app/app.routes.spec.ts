import { TestBed } from '@angular/core/testing';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '@santashop/core';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';

describe('customer routes', () => {
	let currentUser$: Observable<unknown>;
	const createUrlTree = vi.fn().mockName('Router.createUrlTree');

	beforeEach((): void => {
		currentUser$ = of(null);
		createUrlTree.mockReset().mockReturnValue({ redirected: true });
		TestBed.configureTestingModule({
			providers: [
				{
					provide: AuthService,
					useFactory: (): Partial<AuthService> => ({
						get currentUser$(): Observable<unknown> { return currentUser$; },
					} as Partial<AuthService>),
				},
				{ provide: Router, useValue: { createUrlTree } },
			],
		});
	});

	it('defines the public, authenticated, child, and fallback journeys', async (): Promise<void> => {
		expect(routes.map((route) => route.path)).toEqual(['', 'sign-up', 'pre-registration', '**']);
		const preRegistration = routes.find((route) => route.path === 'pre-registration')!;
		expect(preRegistration.children?.map((route) => route.path)).toEqual(['', 'overview', 'confirmation', 'profile']);

		const components = await Promise.all([
			routes[0].loadComponent!(), routes[1].loadComponent!(), preRegistration.loadComponent!(),
			...preRegistration.children!.filter((route) => route.loadComponent).map((route) => route.loadComponent!()),
		]);
		expect(components).toHaveLength(6);
	});

	it('redirects anonymous visitors to sign-in with their requested return URL', async (): Promise<void> => {
		const guard = routes.find((route) => route.path === 'pre-registration')!.canActivate![0] as CanActivateFn;
		const result = TestBed.runInInjectionContext(() => guard({} as never, { url: '/pre-registration/profile' } as never));

		await expect(firstValueFrom(result as Observable<unknown>)).resolves.toEqual({ redirected: true });
		expect(createUrlTree).toHaveBeenCalledWith(['/'], {
			queryParams: { mode: 'sign-in', returnUrl: '/pre-registration/profile' },
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
