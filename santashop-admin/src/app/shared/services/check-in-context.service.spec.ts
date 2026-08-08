import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, skip, take } from 'rxjs';

import { CheckInContextService } from './check-in-context.service';

describe('CheckInContextService', () => {
	let service: CheckInContextService;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		service = TestBed.inject(CheckInContextService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('normalizes timestamp values and restores a previous slot', async () => {
		const registration = {
			uid: 'customer-1',
			children: [{ id: 1, dateOfBirth: { seconds: 1_700_000_000 } }],
			previousDateTimeSlot: {
				id: 'slot-1',
				dateTime: { seconds: 1_700_010_000, nanoseconds: 5 },
			},
		};

		const received = firstValueFrom(service.currentRegistration$);
		service.setRegistration(registration as never, 'manual');

		const normalized = await received;
		expect(normalized).toBeDefined();
		expect(normalized).toMatchObject({
			dateTimeSlot: { id: 'slot-1' },
		});
		expect(normalized?.dateTimeSlot?.dateTime).toBeInstanceOf(Date);
		expect(registration.children[0].dateOfBirth).toBeInstanceOf(Date);
		await expect(firstValueFrom(service.inputMethod$)).resolves.toBe('manual');
	});

	it('tracks blocked scans and fully resets transient check-in state', async () => {
		const nextBlocked = firstValueFrom(service.blockedScan$.pipe(skip(1), take(1)));
		service.setBlockedScan({
			disposition: 'duplicate-risk',
			registration: { uid: 'customer-1' } as never,
			attempt: { inputMethod: 'manual' } as never,
		});

		await expect(nextBlocked).resolves.toMatchObject({
			disposition: 'duplicate-risk',
		});
		await expect(firstValueFrom(service.inputMethod$)).resolves.toBe('manual');

		service.setCheckIn(3, 'QR123');
		service.reset();

		await expect(firstValueFrom(service.checkin$)).resolves.toBeUndefined();
		await expect(firstValueFrom(service.blockedScan$)).resolves.toBeUndefined();
		await expect(firstValueFrom(service.inputMethod$)).resolves.toBe('camera');
	});
});
