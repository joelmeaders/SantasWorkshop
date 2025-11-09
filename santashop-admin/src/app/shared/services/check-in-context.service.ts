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
					const birthDate = child.dateOfBirth as {
						seconds?: number;
						nanoseconds?: number;
					};
					if (!birthDate.seconds) return;
					child.dateOfBirth = new Timestamp(
						birthDate.seconds,
						birthDate.nanoseconds ?? 0,
					).toDate();
				});

				// If the person previously cancelled their registration
				// and did not pick a new slot, use the previous slot.
				if (
					!registration.dateTimeSlot &&
					registration.previousDateTimeSlot
				) {
					registration.dateTimeSlot =
						registration.previousDateTimeSlot;
				}

				// Convert timestamp to date
				if (!registration.dateTimeSlot?.dateTime) return registration;
				const slot = registration.dateTimeSlot.dateTime as {
					seconds?: number;
					nanoseconds?: number;
				};
				if (slot.seconds !== undefined) {
					registration.dateTimeSlot.dateTime = new Timestamp(
						slot.seconds,
						slot.nanoseconds ?? 0,
					).toDate();
				}

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
