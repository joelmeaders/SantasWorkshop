import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createDefaultPublicParameters } from '@santashop/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsService } from '../../../../shared/services/app-settings.service';
import { AppSettingsPage } from './app-settings.page';

describe('AppSettingsPage', () => {
	const read = vi.fn();
	const publish = vi.fn();
	let component: AppSettingsPage;
	beforeEach(() => {
		read.mockReset().mockResolvedValue({
			settings: createDefaultPublicParameters(),
			etag: 'etag-1',
			version: '1',
		});
		publish.mockReset();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: AppSettingsService, useValue: { read, publish } },
			],
		});
		component = TestBed.runInInjectionContext(() => new AppSettingsPage());
	});
	it('loads the full settings document and publishes edits with the loaded etag', async () => {
		await component.reload();
		component.form.controls.messageEs.setValue('Nuevo mensaje');
		component.form.markAsDirty();
		publish.mockResolvedValue({
			settings: component.form.getRawValue(),
			etag: 'etag-2',
			version: '2',
		});
		await component.publish();
		expect(publish).toHaveBeenCalledWith({
			settings: expect.objectContaining({ messageEs: 'Nuevo mensaje' }),
			expectedEtag: 'etag-1',
		});
		expect(component.form.pristine).toBe(true);
		expect(component.status()).toBe('Published version 2.');
		component.form.markAsDirty();
		await component.publish();
		expect(publish.mock.lastCall?.[0].expectedEtag).toBe('etag-2');
	});
	it.each(['functions/aborted', 'functions/unavailable'])(
		'preserves all unsaved edits after %s',
		async (code) => {
			await component.reload();
			component.form.controls.messageEn.setValue('Unsaved');
			component.form.controls.admin.controls.checkinEnabled.setValue(
				false,
			);
			component.form.markAsDirty();
			publish.mockRejectedValue(
				Object.assign(new Error('Unavailable'), { code }),
			);
			await component.publish();
			expect(component.form.getRawValue().messageEn).toBe('Unsaved');
			expect(component.form.getRawValue().admin.checkinEnabled).toBe(
				false,
			);
			expect(component.form.dirty).toBe(true);
			expect(component.error()).not.toBe('');
			expect(component.busy()).toBe(false);
		},
	);
	it('does not allow publishing before a successful read or without changes', async () => {
		await component.publish();
		await component.reload();
		await component.publish();
		expect(publish).not.toHaveBeenCalled();
	});
	it('rejects malformed loaded settings and preserves edits when reload fails', async () => {
		await component.reload();
		component.form.controls.messageEn.setValue('Keep this');
		component.form.markAsDirty();
		read.mockResolvedValue({
			settings: {},
			etag: 'invalid',
			version: 'bad',
		});
		await component.reload();
		expect(component.form.getRawValue().messageEn).toBe('Keep this');
		expect(component.version()).toBe('1');
		expect(component.form.dirty).toBe(true);
	});
	it('discards edits only after an explicit successful reload', async () => {
		await component.reload();
		component.form.controls.messageEn.setValue('Discard');
		component.form.markAsDirty();
		await component.reload();
		expect(component.form.pristine).toBe(true);
		expect(component.form.getRawValue().messageEn).toBe('');
	});
	it('coalesces user actions while a request is pending', async () => {
		let resolveRead!: (value: unknown) => void;
		read.mockReturnValue(
			new Promise((resolve) => {
				resolveRead = resolve;
			}),
		);
		const pending = component.reload();
		await component.reload();
		await component.publish();
		expect(read).toHaveBeenCalledTimes(1);
		expect(component.form.disabled).toBe(true);
		resolveRead({
			settings: createDefaultPublicParameters(),
			etag: 'e',
			version: '1',
		});
		await pending;
		expect(component.form.enabled).toBe(true);
	});
});
