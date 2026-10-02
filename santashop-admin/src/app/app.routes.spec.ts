import { elevatedUserGuard } from './auth.guards';
import { TestBed } from '@angular/core/testing';
import {
	CanActivateFn,
	CanMatchFn,
	Route,
	Router,
	Routes,
} from '@angular/router';
import { User, IdTokenResult } from 'firebase/auth';
import { AuthWrapper, FunctionsWrapper } from '@santashop/core/admin';
import { BehaviorSubject, Subject, firstValueFrom, Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRoutes } from './admin.routes';
import { routes } from './app.routes';

describe('app routes', () => {
	const currentUser$ = new BehaviorSubject<unknown>(null);
	const createUrlTree = vi.fn((commands: unknown[]) => ({ commands }));

	beforeEach(() => {
		currentUser$.next(null);
		createUrlTree.mockClear();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: AuthWrapper,
					useValue: {
						authState: (): Observable<User | null> =>
							currentUser$ as Observable<User | null>,
					},
				},
				{ provide: FunctionsWrapper, useValue: {} },
				{ provide: Router, useValue: { createUrlTree } },
			],
		});
	});

	const runGuard = async (
		guard: CanActivateFn | CanMatchFn,
	): Promise<unknown> => {
		const result = TestBed.runInInjectionContext(() =>
			(guard as (route: never, state: never) => unknown)(
				{} as never,
				{} as never,
			),
		);
		return firstValueFrom(result as Observable<unknown>);
	};

	const user = (
		claims: Record<string, unknown>,
	): { getIdTokenResult: ReturnType<typeof vi.fn> } => ({
		getIdTokenResult: vi.fn().mockResolvedValue({ claims }),
	});

	it('keeps the Firestore-backed admin workspace behind a lazy route boundary', () => {
		const admin = routes.find((route) => route.path === 'admin');

		expect(admin).toEqual(
			expect.objectContaining({
				path: 'admin',
				canMatch: [expect.any(Function)],
				loadChildren: expect.any(Function),
			}),
		);
		expect(admin?.children).toBeUndefined();
	});

	it('redirects already-elevated users away from sign-in but permits unauthenticated users', async () => {
		const signIn = routes.find((route) => route.path === '');
		const guard = signIn?.canActivate?.[0] as CanActivateFn;

		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: ['checkin'] }));
		await expect(runGuard(guard)).resolves.toEqual({
			commands: ['/admin'],
		});
		currentUser$.next(user({}));
		await expect(runGuard(guard)).resolves.toBe(true);
	});

	it('requires an elevated claim before loading the admin route tree', async () => {
		const admin = routes.find((route) => route.path === 'admin');
		const guard = admin?.canMatch?.[0] as CanMatchFn;

		await expect(runGuard(guard)).resolves.toEqual({ commands: ['/'] });
		currentUser$.next(user({ owner: true }));
		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: ['admin', 'checkin'] }));
		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: ['checkin'] }));
		await expect(runGuard(guard)).resolves.toBe(true);
		currentUser$.next(user({ roles: [] }));
		await expect(runGuard(guard)).resolves.toEqual({ commands: ['/'] });
	});

	it('retains admin-only and owner-only authorization inside the lazy routes', async () => {
		const shell = adminRoutes.find(
			(route) => route.path === '' && route.loadComponent,
		);
		const resend = shell?.children?.find(
			(route) => route.path === 'resend-email',
		);
		const ownerOperations = shell?.children?.find(
			(route) => route.path === 'owner-operations',
		);
		const registration = shell?.children?.find(
			(route) => route.path === 'registration',
		);
		const preRegistration = shell?.children?.find(
			(route) => route.path === 'pre-registration',
		);
		const adminGuard = resend?.canActivate?.[0] as CanActivateFn;
		const ownerGuard = ownerOperations?.canActivate?.[0] as CanActivateFn;
		const registrationGuard = registration
			?.canActivate?.[0] as CanActivateFn;
		const preRegistrationGuard = preRegistration
			?.canActivate?.[0] as CanActivateFn;

		currentUser$.next(user({ roles: ['checkin'] }));
		await expect(runGuard(adminGuard)).resolves.toEqual({
			commands: ['/'],
		});
		currentUser$.next(user({ roles: ['admin', 'checkin'] }));
		await expect(runGuard(adminGuard)).resolves.toBe(true);
		await expect(runGuard(ownerGuard)).resolves.toEqual({
			commands: ['/admin/landing'],
		});
		currentUser$.next(user({ owner: true }));
		await expect(runGuard(ownerGuard)).resolves.toBe(true);

		currentUser$.next(user({ roles: ['checkin'], owner: false }));
		await expect(runGuard(registrationGuard)).resolves.toEqual({
			commands: ['/'],
		});
		await expect(runGuard(preRegistrationGuard)).resolves.toEqual({
			commands: ['/'],
		});
		currentUser$.next(user({ roles: ['admin', 'checkin'], owner: false }));
		await expect(runGuard(registrationGuard)).resolves.toBe(true);
		await expect(runGuard(preRegistrationGuard)).resolves.toBe(true);
	});

	it('restricts App settings to owners without a maintenance guard', async () => {
		const shell = adminRoutes.find(
			(route) => route.path === '' && route.loadComponent,
		);
		const settings = shell?.children?.find(
			(route) => route.path === 'app-settings',
		);
		expect(settings?.canActivate).toHaveLength(1);
		const guard = settings?.canActivate?.[0] as CanActivateFn;
		currentUser$.next(user({ roles: ['admin'] }));
		await expect(runGuard(guard)).resolves.toEqual({
			commands: ['/admin/landing'],
		});
		currentUser$.next(user({ owner: true }));
		await expect(runGuard(guard)).resolves.toBe(true);
	});
	it.each([
		{ role: 'checkin', claims: { roles: ['checkin'], owner: false } },
		{ role: 'admin', claims: { roles: ['admin'], owner: false } },
		{ role: 'owner', claims: { owner: true } },
	])(
		'enforces every main-screen destination for $role users',
		async ({ role, claims }) => {
			currentUser$.next(user(claims));
			const admin = routes.find((route) => route.path === 'admin');
			await expect(
				runGuard(admin?.canMatch?.[0] as CanMatchFn),
			).resolves.toBe(true);
			const shell = adminRoutes.find(
				(route) => route.path === '' && route.loadComponent,
			);
			const destinations = [
				{ path: 'checkin', access: 'checkin' },
				{ path: 'search', access: 'checkin' },
				{ path: 'registration', access: 'admin' },
				{ path: 'pre-registration', access: 'admin' },
				{ path: 'resend-email', access: 'admin' },
				{ path: 'schedule-editor', access: 'admin' },
				{ path: 'email-templates', access: 'admin' },
				{ path: 'users', access: 'admin' },
				{ path: 'app-settings', access: 'owner' },
				{ path: 'owner-operations', access: 'owner' },
				{ path: 'stats/scan-risk', access: 'admin' },
				{ path: 'stats/registration', access: 'admin' },
				{ path: 'stats/check-in', access: 'admin' },
				{ path: 'stats/user', access: 'admin' },
			];
			for (const { path, access } of destinations) {
				let children = shell?.children;
				const outcomes: unknown[] = [];
				for (const segment of path.split('/')) {
					const route = children?.find(
						(candidate) => candidate.path === segment,
					);
					expect(route, path).toBeDefined();
					for (const guard of route?.canActivate ?? []) {
						outcomes.push(await runGuard(guard as CanActivateFn));
					}
					children = route?.children;
				}
				const allowed =
					access === 'checkin' || role === 'owner' || access === role;
				expect(
					outcomes.every((outcome) => outcome === true),
					path,
				).toBe(allowed);
			}
		},
	);
	it('declares every operational destination inside the lazy admin tree', async () => {
		const shell = adminRoutes.find(
			(route) => route.path === '' && route.loadComponent,
		);
		const paths = shell?.children?.map((route) => route.path) ?? [];

		expect(paths).toEqual(
			expect.arrayContaining([
				'landing',
				'checkin',
				'search',
				'registration',
				'pre-registration',
				'resend-email',
				'schedule-editor',
				'email-templates',
				'owner-operations',
				'users',
			]),
		);
		const stats = shell?.children?.find((route) => route.path === 'stats');
		expect(
			stats?.children?.every(
				(route) => typeof route.loadComponent === 'function',
			),
		).toBe(true);
	});

	it('keeps scanner, review, and reports under the persistent quick-action shell', () => {
		const shell = adminRoutes.find(
			(route) => route.path === '' && route.loadComponent,
		);
		expect(adminRoutes).toHaveLength(1);
		const checkin = shell?.children?.find(
			(route) => route.path === 'checkin',
		);
		expect(checkin?.children?.map((route) => route.path)).toEqual(
			expect.arrayContaining([
				'scan',
				'review',
				'confirmation',
				'duplicate/:uid',
			]),
		);
		const stats = shell?.children?.find((route) => route.path === 'stats');
		expect(stats?.canActivate).toHaveLength(1);
	});
	it('resolves every configured lazy page component', async () => {
		const candidates = collectComponentRoutes(adminRoutes);
		const components = await Promise.all(
			candidates.map((route) =>
				(route.loadComponent as () => Promise<unknown>)(),
			),
		);

		expect(components).toHaveLength(candidates.length);
		expect(
			components.every((component) => typeof component === 'function'),
		).toBe(true);
	});
	it('waits for SDK initialization and cancels a prior identity token while guarding navigation', async () => {
		const sdk = new Subject<User | null>();
		TestBed.overrideProvider(AuthWrapper, {
			useValue: { authState: (): Observable<User | null> => sdk },
		});
		const outcomes: unknown[] = [];
		const pending = runGuard(elevatedUserGuard).then((result) => {
			outcomes.push(result);
			return result;
		});
		await Promise.resolve();
		expect(outcomes).toEqual([]);
		let resolve!: (token: IdTokenResult) => void;
		const token = new Promise<IdTokenResult>((done) => {
			resolve = done;
		});
		sdk.next({
			uid: 'a',
			getIdTokenResult: vi.fn().mockReturnValue(token),
		} as unknown as User);
		await Promise.resolve();
		expect(outcomes).toEqual([]);
		sdk.next(null);
		expect(await pending).toEqual({ commands: ['/'] });
		resolve({ claims: { owner: true } } as unknown as IdTokenResult);
		await Promise.resolve();
		expect(outcomes).toEqual([{ commands: ['/'] }]);
		sdk.next({
			uid: 'b',
			getIdTokenResult: vi
				.fn()
				.mockResolvedValue({ claims: { roles: ['checkin'] } }),
		} as unknown as User);
		expect(await runGuard(elevatedUserGuard)).toBe(true);
	});
});

function collectComponentRoutes(routesToInspect: Routes): Route[] {
	return routesToInspect.flatMap((route) => [
		...(route.loadComponent ? [route] : []),
		...collectComponentRoutes(route.children ?? []),
	]);
}
