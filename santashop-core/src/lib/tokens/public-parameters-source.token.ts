import { InjectionToken } from '@angular/core';
import type { PublicParameters, WaitingListSettings } from '@santashop/models';
import type { Observable } from 'rxjs';

export interface PublicParametersSource {
	/** Emits when initial configuration loading finishes, including a failed attempt. */
	readonly startupSettled$?: Observable<void>;
	readonly waitingListSettings$?: Observable<WaitingListSettings>;
	readonly publicParameters$: Observable<PublicParameters | undefined>;
}

export const PUBLIC_PARAMETERS_SOURCE =
	new InjectionToken<PublicParametersSource>('public-parameters-source');
