import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { AuthService, FireRepoLite } from '@santashop/core';
import type { CheckIn } from '@santashop/models';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckinService } from './checkin.service';

describe('CheckinService', () => {
	const uid$ = new BehaviorSubject<string | undefined>(undefined);
	const checkin$ = new BehaviorSubject<CheckIn | undefined>(undefined);
	const read = vi.fn().mockReturnValue(checkin$);
	const collection = vi.fn().mockReturnValue({ read });
	const logout = vi.fn().mockResolvedValue(undefined);
	const present = vi.fn().mockResolvedValue(undefined);
	const onDidDismiss = vi.fn().mockResolvedValue({ role: 'confirm' });
	const createAlert = vi.fn().mockResolvedValue({ present, onDidDismiss });

	beforeEach(() => {
		uid$.next(undefined);
		checkin$.next(undefined);
		read.mockClear();
		collection.mockClear();
		logout.mockClear();
		present.mockClear();
		onDidDismiss.mockClear();
		createAlert.mockClear();
		TestBed.configureTestingModule({
			providers: [
				{ provide: FireRepoLite, useValue: { collection } },
				{ provide: AuthService, useValue: { uid$, logout } },
				{
					provide: AlertController,
					useValue: { create: createAlert },
				},
			],
		});
	});

	it('reports whether the authenticated customer has a check-in record', async () => {
		const service = TestBed.inject(CheckinService);
		uid$.next('customer-1');

		await expect(firstValueFrom(service.hasCheckIn$)).resolves.toBe(false);
		checkin$.next({ inStats: false });
		await expect(firstValueFrom(service.hasCheckIn$)).resolves.toBe(true);
		expect(collection).toHaveBeenCalledWith('checkins');
		expect(read).toHaveBeenCalledWith('customer-1');
	});

	it('alerts and signs out a customer after check-in is observed', async () => {
		TestBed.inject(CheckinService);
		uid$.next('customer-1');
		checkin$.next({ inStats: false });

		await vi.waitFor(() => expect(logout).toHaveBeenCalledWith(true));
		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'Merry Christmas!',
				backdropDismiss: false,
			}),
		);
		expect(present).toHaveBeenCalled();
		expect(onDidDismiss).toHaveBeenCalled();
	});
});
