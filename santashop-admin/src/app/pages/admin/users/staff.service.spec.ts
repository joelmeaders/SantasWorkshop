import { AdminReadRepository } from '../../../shared/services/admin-read-repository.service';
import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import type { CreateStaffUser, StaffAccount } from '@santashop/models';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffService } from './staff.service';

describe('StaffService', () => {
	const accounts = [
		{
			uid: 'staff-1',
			displayName: 'Check-In Staff',
			emailAddress: 'staff@example.com',
			roles: ['checkin'],
			disabled: false,
		},
	] as StaffAccount[];
	const readMany = vi.fn().mockReturnValue(of(accounts));
	const collection = vi.fn().mockReturnValue({ readMany });
	const createStaff = vi.fn().mockResolvedValue({ data: 'staff-2' });
	const updateStaff = vi.fn().mockResolvedValue({ data: undefined });
	const deleteStaff = vi.fn().mockResolvedValue({ data: undefined });
	const callableWrapper = vi.fn((name: string) => {
		const callables: Record<string, ReturnType<typeof vi.fn>> = {
			callableCreateStaffUser: createStaff,
			callableUpdateStaffUser: updateStaff,
			callableDeleteStaffUser: deleteStaff,
		};
		return callables[name];
	});

	beforeEach(() => {
		readMany.mockReset().mockReturnValue(of(accounts));
		collection.mockClear();
		createStaff.mockClear();
		updateStaff.mockClear();
		deleteStaff.mockClear();
		callableWrapper.mockClear();
		TestBed.configureTestingModule({
			providers: [
				{ provide: AdminReadRepository, useValue: { collection } },
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
			],
		});
	});

	it('loads staff accounts from the protected staff collection', async () => {
		const service = TestBed.inject(StaffService);

		await expect(firstValueFrom(service.staffAccounts$)).resolves.toEqual(
			accounts,
		);
		expect(collection).toHaveBeenCalledWith('staff');
		expect(readMany).toHaveBeenCalledWith(expect.any(Array), 'uid');
	});

	it('creates a staff user through the callable API', async () => {
		const service = TestBed.inject(StaffService);
		const request = {
			emailAddress: 'new@example.com',
			displayName: 'New Staff',
			password: 'Password123!',
			roles: ['checkin'],
		} satisfies CreateStaffUser;

		await expect(service.createStaffUser(request)).resolves.toBe('staff-2');
		expect(createStaff).toHaveBeenCalledWith(request);
	});

	it('updates a staff user through the callable API', async () => {
		const service = TestBed.inject(StaffService);
		const request = { uid: 'staff-1', disabled: true };

		await service.updateStaffUser(request);
		expect(updateStaff).toHaveBeenCalledWith(request);
	});

	it('deletes a staff user by uid through the callable API', async () => {
		const service = TestBed.inject(StaffService);

		await service.deleteStaffUser('staff-1');
		expect(deleteStaff).toHaveBeenCalledWith({ uid: 'staff-1' });
	});

	it('reloads after successful mutations and explicit refresh, sharing requests across consumers', async () => {
		const service = TestBed.inject(StaffService);
		const subscription = service.staffAccounts$.subscribe();
		const stateSubscription = service.state$.subscribe();
		expect(readMany).toHaveBeenCalledTimes(1);
		await service.createStaffUser({
			displayName: 'New',
			emailAddress: 'new@example.com',
			password: 'Password123!',
			roles: ['checkin'],
		});
		await service.updateStaffUser({ uid: 'staff-1', disabled: true });
		await service.deleteStaffUser('staff-1');
		service.refresh();
		expect(readMany).toHaveBeenCalledTimes(5);
		subscription.unsubscribe();
		stateSubscription.unsubscribe();
	});

	it('recovers from a failed read when refreshed', () => {
		readMany.mockReturnValueOnce(throwError(() => new Error('offline')));
		const service = TestBed.inject(StaffService);
		const states: string[] = [];
		const subscription = service.state$.subscribe((state) =>
			states.push(state.status),
		);
		service.refresh();
		expect(states).toEqual(['loading', 'error', 'loading', 'ready']);
		subscription.unsubscribe();
	});
});
