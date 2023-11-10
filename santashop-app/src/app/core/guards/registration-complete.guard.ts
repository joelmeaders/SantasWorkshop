import { Injectable } from '@angular/core';
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
export class RegistrationCompleteGuard
	implements CanActivate, CanActivateChild
{
	public readonly isComplete$ = this.service.registrationComplete$.pipe(
		take(1),
		map((isComplete) =>
			isComplete
				? this.router.parseUrl('pre-registration/confirmation')
				: true,
		),
	);

	constructor(
		private readonly service: PreRegistrationService,
		private readonly router: Router,
	) {}

	public canActivate(): Observable<boolean | UrlTree> {
		return this.isComplete$;
	}

	public canActivateChild(): Observable<boolean | UrlTree> {
		return this.isComplete$;
	}
}
