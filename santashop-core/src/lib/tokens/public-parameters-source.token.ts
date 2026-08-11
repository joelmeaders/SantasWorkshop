import { InjectionToken } from '@angular/core';
import type { PublicParameters } from '@santashop/models';
import type { Observable } from 'rxjs';

export interface PublicParametersSource {
	readonly publicParameters$: Observable<PublicParameters | undefined>;
}

export const PUBLIC_PARAMETERS_SOURCE =
	new InjectionToken<PublicParametersSource>('public-parameters-source');
