import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@santashop/core/admin';
import { Observable, map, take } from 'rxjs';

function accessGuard(
	role: 'admin' | 'owner' | 'elevated',
	redirectSignedIn = false,
): Observable<boolean | UrlTree> {
	const auth = inject(AuthService);
	const router = inject(Router);
	return auth.claimsResolved$.pipe(
		map((claims) => {
			const roles: string[] = Array.isArray(claims?.['roles'])
				? claims['roles']
				: [];
			const allowed =
				claims?.['owner'] === true ||
				(role !== 'owner' &&
					(roles.includes('admin') ||
						(role === 'elevated' && roles.includes('checkin'))));
			if (redirectSignedIn)
				return allowed ? router.createUrlTree(['/admin']) : true;
			return allowed
				? true
				: router.createUrlTree([
						role === 'owner' && claims ? '/admin/landing' : '/',
					]);
		}),
		take(1),
	);
}
export const redirectLoggedInToAdminGuard: CanActivateFn = () =>
	accessGuard('elevated', true);
export const adminOnlyGuard: CanActivateFn = () => accessGuard('admin');
export const elevatedUserGuard: CanMatchFn = () => accessGuard('elevated');
export const ownerOnlyGuard: CanActivateFn = () => accessGuard('owner');
