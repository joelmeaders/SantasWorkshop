import { DOCUMENT, inject, InjectionToken, type Provider } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core/customer';
import {
	EMPTY,
	catchError,
	exhaustMap,
	filter,
	fromEvent,
	merge,
	timer,
	type Observable,
} from 'rxjs';
import type { ShopperAccessStatus } from '../../core/services/shopper-access.service';

type WatchShopperRestriction = () => Observable<ShopperAccessStatus>;
export const SHOPPER_ACCESS_WATCH = new InjectionToken<WatchShopperRestriction>(
	'shopper-access-watch',
);

const refreshIntervalMs = 30_000;

/** Recheck only the signed-in shopper's UI; this does not enforce data access. */
export function provideShopperAccessWatch(): Provider {
	return {
		provide: SHOPPER_ACCESS_WATCH,
		useFactory: (): WatchShopperRestriction => {
			const functions = inject(FunctionsWrapper);
			const document = inject(DOCUMENT);
			const readStatus = functions.callableWrapper<
				undefined,
				ShopperAccessStatus
			>('getShopperAccessStatus');
			return (): Observable<ShopperAccessStatus> =>
				merge(
					timer(refreshIntervalMs, refreshIntervalMs),
					fromEvent(document, 'visibilitychange'),
				).pipe(
					filter(() => document.visibilityState === 'visible'),
					exhaustMap(() =>
						readStatus(undefined)
							.then(({ data }) => data)
							.catch(() => null),
					),
					filter(
						(status): status is ShopperAccessStatus =>
							status?.disabled === true,
					),
					catchError(() => EMPTY),
				);
		},
	};
}
