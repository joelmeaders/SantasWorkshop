import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@santashop/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
	const currentUser$ = new BehaviorSubject<unknown>(null);
	const createUrlTree = vi.fn((commands: unknown[]) => ({ commands }));

	beforeEach(() => {
		currentUser$.next(null);
		createUrlTree.mockClear();
		TestBed.configureTestingModule({
			providers: [
				{ provide: AuthService, useValue: { currentUser$ } },
				{ provide: Router, useValue: { createUrlTree } },
			],
		});
	});

	const runGuard = async (guard: CanActivateFn): Promise<unknown> => {
		const result = TestBed.runInInjectionContext(() =>
			guard({} as never, {} as never),
		);
		return firstValueFrom(result as Observable<unknown>);
	};

	const user = (claims: Record<string, unknown>): { getIdTokenResult: ReturnType<typeof vi.fn> } => ({
		getIdTokenResult: vi.fn().mockResolvedValue({ claims }),
	});

	it('should include the schedule editor route under admin', () => {
		// Arrange
		const adminRoute = routes.find((route) => route.path === 'admin');

		// Act
		const scheduleEditorRoute = adminRoute?.children?.find(
			(route) => route.path === 'schedule-editor',
		);

		// Assert
		expect(scheduleEditorRoute).toEqual(
			expect.objectContaining({
				path: 'schedule-editor',
				title: 'DSCS: Schedule Editor',
				loadComponent: expect.any(Function),
			}),
		);
	});

	it('redirects already-elevated users away from sign-in but permits unauthenticated users', async () => {
		const signIn = routes.find((route) => route.path === '');
		const guard = signIn?.canActivate?.[0] as CanActivateFn;

		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: ['checkin'] }));
		await expect(runGuard(guard)).resolves.toEqual({ commands: ['/admin'] });
		currentUser$.next(user({}));
		await expect(runGuard(guard)).resolves.toBe(true);
	});

	it('requires an elevated claim for check-in routes', async () => {
		const scan = routes.find((route) => route.path === 'admin/checkin/scan');
		const guard = scan?.canActivate?.[0] as CanActivateFn;

		await expect(runGuard(guard)).resolves.toEqual({ commands: ['/'] });
		currentUser$.next(user({ owner: true }));
		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ admin: true }));
		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: ['checkin'] }));
		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: [] }));
		await expect(runGuard(guard)).resolves.toEqual({ commands: ['/'] });
	});

	it('requires admin claims for protected tool routes and owner claims for owner operations', async () => {
		const admin = routes.find((route) => route.path === 'admin');
		const resend = admin?.children?.find((route) => route.path === 'resend-email');
		const ownerOperations = admin?.children?.find((route) => route.path === 'owner-operations');
		const adminGuard = resend?.canActivate?.[0] as CanActivateFn;
		const ownerGuard = ownerOperations?.canActivate?.[0] as CanActivateFn;

		currentUser$.next(user({ roles: ['checkin'] }));
		await expect(runGuard(adminGuard)).resolves.toEqual({ commands: ['/'] });
		currentUser$.next(user({ admin: true }));
		await expect(runGuard(adminGuard)).resolves.toBe(true);
		await expect(runGuard(ownerGuard)).resolves.toEqual({ commands: ['/admin/landing'] });
		currentUser$.next(user({ owner: true }));
		await expect(runGuard(ownerGuard)).resolves.toBe(true);
	});

	it('declares every supported operational destination with lazy loading', () => {
		const admin = routes.find((route) => route.path === 'admin');
		const paths = admin?.children?.map((route) => route.path) ?? [];
		expect(paths).toEqual(expect.arrayContaining([
			'landing', 'checkin', 'search', 'registration', 'pre-registration',
			'resend-email', 'schedule-editor', 'email-templates', 'owner-operations', 'users',
		]));
		const stats = routes.find((route) => route.path === 'admin/stats');
		expect(stats?.children?.every((route) => typeof route.loadComponent === 'function')).toBe(true);
	});

	it('resolves the configured lazy page components', async () => {
		const admin = routes.find((route) => route.path === 'admin');
		const stats = routes.find((route) => route.path === 'admin/stats');
		const candidates = [
			...routes,
			...(admin?.children ?? []),
			...(stats?.children ?? []),
		].filter((route) => typeof route.loadComponent === 'function');

		const components = await Promise.all(
			candidates.map((route) =>
				(route.loadComponent as () => Promise<unknown>)(),
			),
		);

		expect(components).toHaveLength(candidates.length);
		expect(components.every((component) => typeof component === 'function')).toBe(
			true,
		);
	});
});
