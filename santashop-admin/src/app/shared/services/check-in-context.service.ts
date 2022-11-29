import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { BehaviorSubject, filter, map, shareReplay } from 'rxjs';
import { Registration } from '@models/*';

@Injectable()
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
			filter((registration) => !!registration),
			map((registration) => {
				if (!registration) return;
				// Convert timestamp to date
				registration.children?.forEach((child) => {
					const birthDate = child.dateOfBirth as any;
					if (!birthDate.seconds) return;
					child.dateOfBirth = new Timestamp(
						birthDate.seconds,
						birthDate.nanoseconds
					).toDate();
				});

				// Convert timestamp to date
				const slot = registration.dateTimeSlot!.dateTime as any;
				registration.dateTimeSlot!.dateTime = new Timestamp(
					slot.seconds,
					slot.nanoseconds
				).toDate();

				return registration;
			}),
			shareReplay(1)
		);

	constructor() {}

	public setRegistration(registration: Registration): void {
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
