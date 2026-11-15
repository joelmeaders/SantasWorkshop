import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { AuthService, FunctionsWrapper } from '@santashop/core/customer';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopperAccessService } from './shopper-access.service';

describe('ShopperAccessService', () => {
	const status = vi.fn();
	const logout = vi.fn();
	const present = vi.fn();
	const create = vi.fn();
	const currentUser$ = new BehaviorSubject<{ uid: string } | null>(null);
	let service: ShopperAccessService;

	beforeEach(() => {
		vi.resetAllMocks();
		currentUser$.next({ uid: 'synthetic-shopper' });
		create.mockResolvedValue({ present });
		TestBed.configureTestingModule({
			providers: [
				{ provide: AuthService, useValue: { currentUser$, logout } },
				{ provide: FunctionsWrapper, useValue: { callableWrapper: (): typeof status => status } },
				{ provide: ModalController, useValue: { create } },
			],
		});
		service = TestBed.inject(ShopperAccessService);
	});

	it('lets an active shopper continue without a modal or sign-out', async (): Promise<void> => {
		status.mockResolvedValue({ data: { disabled: false, hasActiveRegistration: false } });
		await expect(service.verify('synthetic-shopper')).resolves.toBe(true);
		expect(logout).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('signs out a disabled shopper and supplies active-registration context to the notice', async (): Promise<void> => {
		status.mockResolvedValue({ data: { disabled: true, hasActiveRegistration: true } });
		await expect(service.verify('synthetic-shopper')).resolves.toBe(false);
		expect(logout).toHaveBeenCalledWith(false);
		expect(create).toHaveBeenCalledWith(expect.objectContaining({
			componentProps: { hasActiveRegistration: true },
		}));
		expect(present).toHaveBeenCalledOnce();
	});

	it('does not show a late restriction result for a different current identity', async (): Promise<void> => {
		status.mockImplementation(async () => {
			currentUser$.next({ uid: 'different-shopper' });
			return { data: { disabled: true, hasActiveRegistration: false } };
		});
		await expect(service.verify('synthetic-shopper')).resolves.toBe(false);
		expect(logout).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});
});
