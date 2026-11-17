import { Injector, runInInjectionContext } from '@angular/core';
import {
	type ActivatedRouteSnapshot,
	Router,
	type RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '@santashop/core/admin';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { registrationReviewGuard } from './registration-review-route.guard';
import {
	REGISTRATION_REVIEW_READER,
	type ReviewClaims,
} from './registration-review-reader';

const landing = { testUrl: '/admin/landing' };
const route = {} as ActivatedRouteSnapshot;
const snapshot = {} as RouterStateSnapshot;

async function evaluateGuard(
	claims: ReviewClaims | undefined,
	readerEnabled = true,
): Promise<unknown> {
	const createUrlTree = vi.fn(() => landing);
	const injector = Injector.create({
		providers: [
			{ provide: Router, useValue: { createUrlTree } },
			{ provide: AuthService, useValue: { claimsResolved$: of(claims) } },
			...(readerEnabled
				? [{ provide: REGISTRATION_REVIEW_READER, useValue: {} }]
				: []),
		],
	});
	const result = runInInjectionContext(injector, () =>
		registrationReviewGuard(route, snapshot),
	);
	expect(createUrlTree).toHaveBeenCalledWith(['/admin/landing']);
	return isObservable(result) ? firstValueFrom(result) : result;
}

describe('registration review route guard', () => {
	it('allows an Owner and a specifically delegated Admin', async () => {
		await expect(evaluateGuard({ owner: true })).resolves.toBe(true);
		await expect(
			evaluateGuard({ roles: ['admin', 'registration-review'] }),
		).resolves.toBe(true);
	});
	it('rejects ordinary Admin, standalone permission, and missing identity', async () => {
		for (const claims of [
			{ roles: ['admin'] },
			{ roles: ['registration-review'] },
			undefined,
		]) {
			await expect(evaluateGuard(claims)).resolves.toBe(landing);
		}
	});
	it('fails closed for Owner without a data provider', async () => {
		await expect(evaluateGuard({ owner: true }, false)).resolves.toBe(
			landing,
		);
	});
});
