import { Injectable, inject } from '@angular/core';
import {
	CanActivate,
	CanActivateChild,
	Router,
	UrlTree,
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { PreRegistrationService } from '../services/pre-registration.service';

@Injectable({
	providedIn: 'root',
})
export class RegistrationReadyToSubmitGuard
	implements CanActivate, CanActivateChild
{
	private readonly service = inject(PreRegistrationService);
	private readonly router = inject(Router);

	public readonly isReady$ = this.service.registrationReadyToSubmit$.pipe(
		take(1),
		map((isReady) =>
			isReady ? true : this.router.parseUrl('pre-registration/overview'),
		),
	);

	public canActivate(): Observable<boolean | UrlTree> {
		return this.isReady$;
	}

	public canActivateChild(): Observable<boolean | UrlTree> {
		return this.isReady$;
	}
}
