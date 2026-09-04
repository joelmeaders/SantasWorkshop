import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '@santashop/core/admin';
import { from, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

export const redirectLoggedInToAdminGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(true);
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) => {
					const claims = token.claims ?? {};
					const roles =
						(claims['roles'] as string[] | undefined) ?? [];

					return claims['owner'] === true ||
						claims['admin'] === true ||
						roles.includes('admin') ||
						roles.includes('checkin')
						? router.createUrlTree(['/admin'])
						: true;
				}),
			);
		}),
	);
};

export const adminOnlyGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(router.createUrlTree(['/']));
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) =>
					token.claims?.['owner'] === true ||
					token.claims?.['admin'] === true
						? true
						: router.createUrlTree(['/']),
				),
			);
		}),
	);
};

export const elevatedUserGuard: CanMatchFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(router.createUrlTree(['/']));
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) => {
					const claims = token.claims ?? {};
					const roles =
						(claims['roles'] as string[] | undefined) ?? [];

					return claims['owner'] === true ||
						claims['admin'] === true ||
						roles.includes('admin') ||
						roles.includes('checkin')
						? true
						: router.createUrlTree(['/']);
				}),
			);
		}),
	);
};

export const ownerOnlyGuard: CanActivateFn = () => {
	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.currentUser$.pipe(
		take(1),
		switchMap((user) => {
			if (!user) {
				return of(router.createUrlTree(['/']));
			}

			return from(user.getIdTokenResult(false)).pipe(
				map((token) =>
					token.claims?.['owner'] === true
						? true
						: router.createUrlTree(['/admin/landing']),
				),
			);
		}),
	);
};
