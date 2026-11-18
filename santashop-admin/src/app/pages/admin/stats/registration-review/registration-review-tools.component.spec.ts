import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import {
	REGISTRATION_REVIEW_READER,
	type RegistrationReviewReader,
	type ReviewCaseRegistration,
	type ReviewMutationResult,
} from './registration-review-reader';
import { RegistrationReviewToolsComponent } from './registration-review-tools.component';

const record: ReviewCaseRegistration = {
	id: 'DEMO-R1',
	name: 'First Fixture',
	email: 'first@example.test',
	appointment: '',
	expectedRevision: '10:0',
	availableActions: [
		'contact',
		'editChild',
		'removeChild',
		'restoreChild',
		'cancel',
		'reinstate',
		'blacklist',
		'unblacklist',
	],
	children: [
		{
			childIndex: 0,
			name: 'Ari Fixture',
			firstName: 'Ari',
			lastName: 'Fixture',
			birthDate: '2018-06-01',
			enabled: true,
		},
		{
			childIndex: 0,
			name: 'Ren Fixture',
			removed: true,
			birthDate: '2017-06-01',
		},
		{ name: 'Unlinked Fixture', birthDate: '' },
	],
};

describe('RegistrationReviewToolsComponent', () => {
	const performAction =
		vi.fn<NonNullable<RegistrationReviewReader['performAction']>>();
	let fixture: ComponentFixture<RegistrationReviewToolsComponent>;
	let component: RegistrationReviewToolsComponent;

	beforeEach(() => {
		performAction.mockReset();
		TestBed.configureTestingModule({
			imports: [RegistrationReviewToolsComponent],
			providers: [
				{
					provide: REGISTRATION_REVIEW_READER,
					useValue: { performAction },
				},
			],
		});
		fixture = TestBed.createComponent(RegistrationReviewToolsComponent);
		fixture.componentRef.setInput('caseId', 'DEMO-CASE');
		fixture.componentRef.setInput('record', record);
		fixture.componentRef.setInput('claims', { owner: true });
		fixture.detectChanges();
		component = fixture.componentInstance;
	});

	it('only lists server-authorized and revision-bound options in escalation order', () => {
		expect(component.steps().map(({ action }) => action)).toEqual([
			'contact',
			'editChild',
			'removeChild',
			'cancel',
			'blacklist',
		]);
		expect(component.recovery().map(({ action }) => action)).toEqual([
			'restoreChild',
			'reinstate',
			'unblacklist',
		]);
		fixture.componentRef.setInput('claims', {
			roles: ['admin', 'registration-review'],
		});
		expect(
			component.steps().some(({ action }) => action === 'blacklist'),
		).toBe(false);
		expect(
			component.recovery().some(({ action }) => action === 'unblacklist'),
		).toBe(false);
		fixture.componentRef.setInput('claims', { roles: ['admin'] });
		expect(component.steps()).toEqual([]);
		expect(component.recovery()).toEqual([]);
	});

	it('holds submission for a valid child edit, sends no email by default, and never submits twice in flight', () => {
		const response = new Subject<ReviewMutationResult>();
		performAction.mockReturnValue(response);
		const messages: string[] = [];
		component.updated.subscribe((message) => messages.push(message));
		const option = component
			.steps()
			.find(({ action }) => action === 'editChild');
		if (!option) throw new Error('Missing synthetic child option.');
		component.open(option);
		fixture.detectChanges();
		const dialog = (fixture.nativeElement as HTMLElement).querySelector(
			'dialog',
		);
		expect(dialog?.querySelector('input[type=checkbox]')).toBeNull();
		expect(dialog?.querySelectorAll('textarea')).toHaveLength(0);
		expect(component.canConfirm()).toBe(false);
		component.reason.set('correct-child-information');
		component.notify.set(true);
		component.birthDate.set('malformed');
		component.confirm(new Event('submit'));
		expect(performAction).not.toHaveBeenCalled();
		component.birthDate.set('2018-08-22');
		component.firstName.set('  Ariella  ');
		component.confirm(new Event('submit'));
		component.confirm(new Event('submit'));
		component.close(new Event('cancel', { cancelable: true }));
		expect(performAction).toHaveBeenCalledTimes(1);
		expect(performAction).toHaveBeenCalledWith({
			action: 'editChild',
			caseId: 'DEMO-CASE',
			registrationId: 'DEMO-R1',
			expectedRevision: '10:0',
			mutationId: expect.any(String),
			reason: 'correct-child-information',
			childIndex: 0,
			child: {
				firstName: 'Ariella',
				lastName: 'Fixture',
				birthDate: '2018-08-22',
			},
		});
		response.next({
			action: 'editChild',
			registrationId: 'DEMO-R1',
			notification: 'not-requested',
		});
		expect(component.prompt()).toBeNull();
		expect(messages).toEqual([
			'Action recorded. No shopper email was requested.',
		]);
	});

	it('rejects a stale selection before sending and retains the mutation ID for an identical retry', () => {
		performAction
			.mockReturnValueOnce(
				throwError(() => new Error('Temporary synthetic failure')),
			)
			.mockReturnValueOnce(
				of({
					action: 'contact',
					registrationId: 'DEMO-R1',
					notification: 'queued',
				}),
			);
		const option = component.steps()[0];
		component.open(option);
		component.reason.set('verify-registration');
		component.message.set('  Selected shopper only  ');
		fixture.componentRef.setInput('record', {
			...record,
			expectedRevision: '11:0',
		});
		component.confirm(new Event('submit'));
		expect(component.error()).toContain('Registration changed');
		expect(performAction).not.toHaveBeenCalled();
		fixture.componentRef.setInput('record', record);
		component.confirm(new Event('submit'));
		expect(component.error()).toContain('not confirmed');
		component.confirm(new Event('submit'));
		expect(performAction.mock.calls[0][0]).toEqual(
			performAction.mock.calls[1][0],
		);
		expect(performAction.mock.calls[1][0].notification).toEqual({
			recipient: 'first@example.test',
			customMessage: 'Selected shopper only',
		});
	});

	it('distinguishes confirmed policy with unverified sign-in from a completed unblock', () => {
		const updated = vi.fn();
		component.updated.subscribe(updated);
		const block = component
			.steps()
			.find(({ action }) => action === 'blacklist');
		const unblock = component
			.recovery()
			.find(({ action }) => action === 'unblacklist');
		if (!block || !unblock)
			throw new Error('Missing synthetic owner options.');
		performAction
			.mockReturnValueOnce(
				throwError(() => ({
					details: {
						reviewActionState: 'block-active-auth-unverified',
					},
				})),
			)
			.mockReturnValueOnce(
				of({
					action: 'unblacklist',
					registrationId: record.id,
					notification: 'not-requested',
					authAccess: 'requires-manual-review',
				}),
			);
		component.open(block);
		component.reason.set('both-parents-registered-same-children');
		component.confirm(new Event('submit'));
		expect(component.error()).toContain(
			'block is active, but sign-in restriction could not be verified',
		);
		component.close();
		component.open(unblock);
		component.reason.set('reviewed-and-cleared');
		component.confirm(new Event('submit'));
		expect(updated).toHaveBeenCalledWith(
			'Email block removed. Verify sign-in separately.',
		);
	});
});
