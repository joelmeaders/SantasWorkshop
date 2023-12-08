import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { BehaviorSubject, map, shareReplay } from 'rxjs';
import { Registration } from '@santashop/models';
import { filterNullish } from '../helpers';

@Injectable({
	providedIn: 'root',
})
export class CheckInContextService {
	private readonly registration = new BehaviorSubject<
		Registration | undefined
	>(undefined);

	private readonly checkin = new BehaviorSubject<
		{ code: string; count: number } | undefined
	>(undefined);
	public readonly checkin$ = this.checkin.asObservable();

	public readonly currentRegistration$ = this.registration
		.asObservable()
		.pipe(
			filterNullish<Registration>(),
			map((registration) => {
				if (!registration) return;
				// Convert timestamp to date
				registration.children?.forEach((child) => {
					const birthDate = child.dateOfBirth as any;
					if (!birthDate.seconds) return;
					child.dateOfBirth = new Timestamp(
						birthDate.seconds,
						birthDate.nanoseconds,
					).toDate();
				});

				// If the person previously cancelled their registration 
				// and did not pick a new slot, use the previous slot.
				if (!registration.dateTimeSlot && registration.previousDateTimeSlot) {
					registration.dateTimeSlot = registration.previousDateTimeSlot;
				};

				// Convert timestamp to date
				const slot = registration.dateTimeSlot!.dateTime as any;
				registration.dateTimeSlot!.dateTime = new Timestamp(
					slot.seconds,
					slot.nanoseconds,
				).toDate();

				return registration;
			}),
			shareReplay(1),
		);

	public setRegistration(registration?: Registration): void {
		this.registration.next(registration);
	}

	public resetRegistration(): void {
		this.registration.next(undefined);
	}

	public setCheckIn(count: number, code: string): void {
		this.checkin.next({ count, code });
	}

	public reset(): void {
		this.registration.next(undefined);
		this.checkin.next(undefined);
	}
}
