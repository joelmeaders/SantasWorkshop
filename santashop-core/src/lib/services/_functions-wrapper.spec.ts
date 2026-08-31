import { TestBed } from '@angular/core/testing';
import { httpsCallable, type Functions } from 'firebase/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_FUNCTIONS } from '../tokens';
import { FunctionsWrapper } from './_functions-wrapper';

describe('FunctionsWrapper', () => {
	let service: FunctionsWrapper;
	const functions = {} as Functions;
	const callable = vi.fn();

	beforeEach(() => {
		vi.mocked(httpsCallable).mockReset();
		callable.mockReset().mockResolvedValue({ data: true });
		vi.mocked(httpsCallable).mockReturnValue(callable as never);
		TestBed.configureTestingModule({
			providers: [{ provide: FIREBASE_FUNCTIONS, useValue: functions }],
		});
		service = TestBed.inject(FunctionsWrapper);
	});

	it('creates a callable against the configured Functions instance', () => {
		expect(service.callableWrapper('testCallable')).toBe(callable);
		expect(httpsCallable).toHaveBeenCalledWith(functions, 'testCallable');
	});

	it.each([
		['updateEmailAddress', ['new@example.test'], 'updateEmailAddress', { emailAddress: 'new@example.test' }],
		['changeAccountInformation', [{ firstName: 'Ada' }], 'changeAccountInformation', { firstName: 'Ada' }],
		['updateReferredBy', [{ referredBy: 'friend' }], 'updateReferredBy', { referredBy: 'friend' }],
		['undoRegistration', [{ mutationId: 'm1', uid: 'u1' }], 'undoRegistration', { mutationId: 'm1', uid: 'u1' }],
		['changeRegistrationDateTime', [{ mutationId: 'm2', slotId: 'slot-1' }], 'changeRegistrationDateTime', { mutationId: 'm2', slotId: 'slot-1' }],
		['saveDraftChild', [{ mutationId: 'm3', child: { id: 1, firstName: 'A', lastName: 'B', dateOfBirth: '2020-01-01' } }], 'saveDraftChild', { mutationId: 'm3', child: { id: 1, firstName: 'A', lastName: 'B', dateOfBirth: '2020-01-01' } }],
		['deleteDraftChild', [{ mutationId: 'm4', childId: 1 }], 'deleteDraftChild', { mutationId: 'm4', childId: 1 }],
		['setDraftAppointment', [{ mutationId: 'm5', slotId: 'slot-2' }], 'setDraftAppointment', { mutationId: 'm5', slotId: 'slot-2' }],
		['completeRegistration', [{ mutationId: 'm6' }], 'completeRegistration', { mutationId: 'm6' }],
	] as const)('forwards %s to its named callable', async (method, args, callableName, payload) => {
		const action = service[method] as (...values: readonly unknown[]) => Promise<unknown>;

		await action(...args);

		expect(httpsCallable).toHaveBeenCalledWith(functions, callableName);
		expect(callable).toHaveBeenCalledWith(payload);
	});
});
