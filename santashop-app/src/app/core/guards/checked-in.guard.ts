/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, inject } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	CanActivateChild,
	RouterStateSnapshot,
} from '@angular/router';
import { Observable, of, switchMap } from 'rxjs';
import { CheckinService } from '../services/checkin.service';

@Injectable({
	providedIn: 'root',
})
export class CheckedInGuard implements CanActivate, CanActivateChild {
	private readonly checkinService = inject(CheckinService);

	public canActivate(
		_route: ActivatedRouteSnapshot,
		_state: RouterStateSnapshot,
	): Observable<boolean> {
		return this.checkinService.hasCheckIn$.pipe(
			switchMap((hasCheckIn) => (hasCheckIn ? of(false) : of(true))),
		);
	}
	public canActivateChild(
		_childRoute: ActivatedRouteSnapshot,
		_state: RouterStateSnapshot,
	): Observable<boolean> {
		return this.checkinService.hasCheckIn$.pipe(
			switchMap((hasCheckIn) => (hasCheckIn ? of(false) : of(true))),
		);
	}
}
