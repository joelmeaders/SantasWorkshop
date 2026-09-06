import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { AuthService, FireRepoLite } from '@santashop/core';
import type { CheckIn } from '@santashop/models';
import { BehaviorSubject, finalize, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckinService } from './checkin.service';

describe('CheckinService', () => {
	const currentUser$ = new BehaviorSubject<{ uid: string } | null>(null);
	const checkin$ = new BehaviorSubject<CheckIn | undefined>(undefined);
	const read = vi.fn().mockReturnValue(checkin$);
	const collection = vi.fn().mockReturnValue({ read });
	const logout = vi.fn().mockResolvedValue(undefined);
	const present = vi.fn().mockResolvedValue(undefined);
	const onDidDismiss = vi.fn().mockResolvedValue({ role: 'confirm' });
	const createAlert = vi.fn().mockResolvedValue({ present, onDidDismiss });
	const instant = vi.fn((key: string): string => key);

	beforeEach(() => {
		currentUser$.next(null);
		checkin$.next(undefined);
		read.mockClear();
		collection.mockClear();
		logout.mockClear();
		present.mockClear();
		onDidDismiss.mockClear();
		createAlert.mockClear();
		instant.mockReset().mockImplementation((key: string): string => key);
		read.mockReturnValue(checkin$);
		TestBed.configureTestingModule({
			providers: [
				{ provide: TranslateService, useValue: { instant } },
				{ provide: FireRepoLite, useValue: { collection } },
				{ provide: AuthService, useValue: { currentUser$, logout } },
				{
					provide: AlertController,
					useValue: { create: createAlert },
				},
			],
		});
	});

	afterEach(() => {
		TestBed.inject(CheckinService).checkinAlertSubscription.unsubscribe();
	});

	it('reports whether the authenticated customer has a check-in record', async () => {
		const service = TestBed.inject(CheckinService);
		currentUser$.next({ uid: 'customer-1' });

		await expect(firstValueFrom(service.hasCheckIn$)).resolves.toBe(false);
		checkin$.next({ inStats: false });
		await expect(firstValueFrom(service.hasCheckIn$)).resolves.toBe(true);
		expect(collection).toHaveBeenCalledWith('checkins');
		expect(read).toHaveBeenCalledWith('customer-1');
	});

	it('alerts and signs out a customer after check-in is observed', async () => {
		TestBed.inject(CheckinService);
		currentUser$.next({ uid: 'customer-1' });
		checkin$.next({ inStats: false });

		await vi.waitFor(() => expect(logout).toHaveBeenCalledWith(true));
		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({
				header: 'CHECKIN.COMPLETE_TITLE',
				subHeader: 'CHECKIN.COMPLETE_SUBTITLE',
				message: 'CHECKIN.COMPLETE_MESSAGE',
				buttons: ['CHECKIN.OK'],
				backdropDismiss: false,
			}),
		);
		expect(present).toHaveBeenCalled();
		expect(onDidDismiss).toHaveBeenCalled();
	});

	it('shows the notice again after a checked-in customer signs in again', async () => {
		TestBed.inject(CheckinService);
		currentUser$.next({ uid: 'customer-1' });
		checkin$.next({ inStats: false });
		await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce());
		currentUser$.next(null);
		currentUser$.next({ uid: 'customer-1' });
		await vi.waitFor(() => expect(logout).toHaveBeenCalledTimes(2));
		expect(createAlert).toHaveBeenCalledTimes(2);
	});

	it('unsubscribes from the protected record when the customer signs out', () => {
		const stopped = vi.fn();
		read.mockReturnValue(checkin$.pipe(finalize(stopped)));
		TestBed.inject(CheckinService);
		currentUser$.next({ uid: 'customer-1' });
		expect(stopped).not.toHaveBeenCalled();
		currentUser$.next(null);
		expect(stopped).toHaveBeenCalledOnce();
		checkin$.next({ inStats: false });
		expect(createAlert).not.toHaveBeenCalled();
	});
});
