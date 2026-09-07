import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import { createDefaultPublicParameters } from '@santashop/models';
import { describe, expect, it, vi } from 'vitest';
import { AppSettingsService } from './app-settings.service';

describe('AppSettingsService', () => {
	it('uses owner callables and passes the expected template etag', async () => {
		const response = {
			settings: createDefaultPublicParameters(),
			etag: 'e1',
			version: '1',
		};
		const callable = vi.fn().mockResolvedValue({ data: response });
		const callableWrapper = vi.fn().mockReturnValue(callable);
		TestBed.configureTestingModule({
			providers: [
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
			],
		});
		const service = TestBed.inject(AppSettingsService);
		await expect(service.read()).resolves.toEqual(response);
		expect(callableWrapper).toHaveBeenCalledWith(
			'readPublicParametersSettings',
		);
		const request = {
			settings: response.settings,
			expectedEtag: response.etag,
		};
		await expect(service.publish(request)).resolves.toEqual(response);
		expect(callableWrapper).toHaveBeenCalledWith(
			'publishPublicParametersSettings',
		);
		expect(callable).toHaveBeenLastCalledWith(request);
	});
});
