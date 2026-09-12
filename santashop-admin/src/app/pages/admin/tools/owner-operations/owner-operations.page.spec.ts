import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideActivatedRouteMock } from '../../../../../test-helpers';
import { OwnerOperationsPage } from './owner-operations.page';
import { OwnerOperationsService } from './owner-operations.service';

interface OwnerOperationPageInternals {
	poll(operationId: string): Promise<void>;
	showError(error: unknown): void;
}

describe('OwnerOperationsPage', () => {
	let component: OwnerOperationsPage;
	let fixture: ComponentFixture<OwnerOperationsPage>;
	const preview = vi.fn();
	const start = vi.fn();
	const get = vi.fn();
	const getExportUrl = vi.fn();
	const reauthenticate = vi.fn();

	beforeEach(async () => {
		preview.mockReset();
		start.mockReset();
		get.mockReset();
		getExportUrl.mockReset();
		reauthenticate.mockReset();
		TestBed.configureTestingModule({
			imports: [OwnerOperationsPage],
			providers: [
				{ provide: PROGRAM_YEAR, useValue: 2026 },
				{ provide: AuthService, useValue: { reauthenticate } },
				{
					provide: OwnerOperationsService,
					useValue: { preview, start, get, getExportUrl },
				},
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(OwnerOperationsPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('switches the year when a yearly reset is selected and clears prior state', () => {
		component.preview.set({ previewId: 'old' } as never);
		component.operation.set({ id: 'old' } as never);
		component.errorMessage.set('old error');
		component.form.controls.operation.setValue('yearly-reset');

		component.onOperationChange();

		expect(component.preview()).toBeUndefined();
		expect(component.operation()).toBeUndefined();
		expect(component.form.controls.programYear.value).toBe(
			new Date().getFullYear() - 1,
		);
	});

	it('creates a preview with the requested seasonal year and clears confirmation', async () => {
		preview.mockResolvedValue({
			previewId: 'preview-1',
			operation: 'queue-reminder-emails',
			confirmationPhrase: 'CONFIRM',
		});
		component.form.controls.confirmationPhrase.setValue('stale');

		await component.createPreview();

		expect(preview).toHaveBeenCalledWith({
			operation: 'queue-reminder-emails',
			programYear: 2026,
		});
		expect(component.preview()).toMatchObject({ previewId: 'preview-1' });
		expect(component.form.controls.confirmationPhrase.value).toBe('');
		expect(component.statusMessage()).toContain('Preview ready');
		expect(component.busy()).toBe(false);
	});

	it('reauthenticates, starts the operation, and stops polling on success', async () => {
		component.preview.set({ previewId: 'preview-1' } as never);
		component.form.controls.password.setValue('password');
		component.form.controls.confirmationPhrase.setValue('CONFIRM');
		reauthenticate.mockResolvedValue(undefined);
		start.mockResolvedValue({ operationId: 'operation-1' });
		get.mockResolvedValue({
			id: 'operation-1',
			operation: 'yearly-reset',
			status: 'succeeded',
		});

		await component.start();

		expect(reauthenticate).toHaveBeenCalledWith('password');
		expect(start).toHaveBeenCalledWith({
			previewId: 'preview-1',
			confirmationPhrase: 'CONFIRM',
		});
		expect(get).toHaveBeenCalledWith('operation-1');
		expect(component.form.controls.password.value).toBe('');
		expect(component.busy()).toBe(false);
	});

	it('marks invalid forms touched instead of starting a privileged operation', async () => {
		await component.start();

		expect(start).not.toHaveBeenCalled();
		expect(component.form.touched).toBe(true);
	});

	it('retries a failed first status read without starting the job again', async () => {
		component.preview.set({ previewId: 'preview-1' } as never);
		component.form.controls.password.setValue('password');
		component.form.controls.confirmationPhrase.setValue('CONFIRM');
		start.mockResolvedValue({ operationId: 'operation-1' });
		get.mockRejectedValueOnce(new Error('Connection lost'));
		await component.start();
		expect(component.operationId()).toBe('operation-1');
		expect(component.errorMessage()).toBe('Connection lost');
		expect(component.busy()).toBe(false);
		get.mockResolvedValue({ id: 'operation-1', status: 'succeeded' });
		await component.refreshStatus();
		await component.start();
		expect(start).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenNthCalledWith(2, 'operation-1');
		expect(component.operation()?.status).toBe('succeeded');
		expect(component.errorMessage()).toBe('');
	});

	it('ignores a status response after the selected operation changes', async () => {
		let resolve!: (value: unknown) => void;
		get.mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				}),
		);
		component.operationId.set('old-operation');
		const pending = component.refreshStatus();
		component.onOperationChange();
		resolve({ id: 'old-operation', status: 'succeeded' });
		await pending;
		expect(component.operation()).toBeUndefined();
		expect(component.operationId()).toBeUndefined();
		expect(component.busy()).toBe(false);
	});

	it('reports failed operation and callable errors to the operator', async () => {
		get.mockResolvedValue({
			id: 'operation-1',
			operation: 'yearly-reset',
			status: 'failed',
			errorMessage: 'Denied',
		});

		await (component as unknown as OwnerOperationPageInternals).poll(
			'operation-1',
		);
		(component as unknown as OwnerOperationPageInternals).showError({
			details: 'Use owner access',
		});

		expect(component.errorMessage()).toBe('Use owner access');
		expect(component.busy()).toBe(false);
		expect(component.statusMessage()).toBe('');
	});

	it('does not poll before a job exists', async () => {
		await component.refreshStatus();
		expect(get).not.toHaveBeenCalled();
	});

	it('ignores a failed status request after the selected operation changes', async () => {
		let reject!: (error: Error) => void;
		get.mockImplementation(
			() =>
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
		);
		component.operationId.set('old-operation');
		const pending = component.refreshStatus();
		component.onOperationChange();
		reject(new Error('Old request failed'));
		await pending;
		expect(component.errorMessage()).toBe('');
		expect(component.busy()).toBe(false);
	});

	it('stops automatic polling after failure and resumes the same job on refresh', async () => {
		vi.useFakeTimers();
		try {
			component.operationId.set('job-1');
			get.mockResolvedValueOnce({ id: 'job-1', status: 'running' });
			get.mockRejectedValueOnce(new Error('Polling interrupted'));
			await component.refreshStatus();
			await vi.advanceTimersByTimeAsync(2000);
			expect(component.errorMessage()).toBe('Polling interrupted');
			expect(component.busy()).toBe(false);
			await vi.advanceTimersByTimeAsync(4000);
			expect(get).toHaveBeenCalledTimes(2);
			get.mockResolvedValue({ id: 'job-1', status: 'succeeded' });
			await component.refreshStatus();
			expect(get).toHaveBeenLastCalledWith('job-1');
			expect(component.operation()?.status).toBe('succeeded');
			expect(start).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
