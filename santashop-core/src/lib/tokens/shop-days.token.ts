import { InjectionToken } from '@angular/core';

/** Configured day-of-month values for the active program year. */
export const SHOP_DAYS = new InjectionToken<readonly number[]>('shop-days');
