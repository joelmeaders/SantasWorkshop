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
export class RegistrationIncompleteGuard
	implements CanActivate, CanActivateChild
{
	public readonly isComplete$ = this.service.registrationComplete$.pipe(
		take(1),
		map((isComplete) =>
			isComplete
				? true
				: this.router.parseUrl('pre-registration/overview')
		)
	);

	constructor(
		private readonly service: PreRegistrationService,
		private readonly router: Router
	) {}

	public canActivate(): Observable<boolean | UrlTree> {
		return this.isComplete$;
	}

	public canActivateChild(): Observable<boolean | UrlTree> {
		return this.isComplete$;
	}
}
