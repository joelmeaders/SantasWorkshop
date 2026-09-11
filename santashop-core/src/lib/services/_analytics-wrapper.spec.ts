import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { logEvent, type Analytics } from 'firebase/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_ANALYTICS, PROGRAM_YEAR } from '../tokens';
import {
	ANALYTICS_APP_AREA,
	ANALYTICS_EVENTS,
	AnalyticsWrapper,
	analyticsErrorCode,
	optionalAnalytics,
	trackAnalyticsOperation,
} from './_analytics-wrapper';

describe('AnalyticsWrapper', () => {
	const analytics = {} as Analytics;
	const currentLanguage = vi.fn(() => 'es');
	const context = {
		event_schema_version: 2,
		app_area: 'customer',
		language: 'es',
		program_year: 2026,
	};

	beforeEach(() => {
		vi.mocked(logEvent).mockReset();
		currentLanguage.mockReset().mockReturnValue('es');
	});

	const createService = (value: Analytics | null): AnalyticsWrapper => {
		TestBed.configureTestingModule({
			providers: [
				{ provide: FIREBASE_ANALYTICS, useValue: value },
				{ provide: ANALYTICS_APP_AREA, useValue: 'customer' },
				{ provide: PROGRAM_YEAR, useValue: 2026 },
				{
					provide: TranslateService,
					useValue: { getCurrentLang: currentLanguage },
				},
			],
		});
		return TestBed.inject(AnalyticsWrapper);
	};

	it('uses a valid stable error event without raw messages or unknown codes', () => {
		const service = createService(analytics);
		service.logErrorEvent(
			'functions/unauthenticated',
			'parent@example.com',
			'create_account',
		);
		service.logErrorEvent({
			code: 'account-parent@example.com',
			message: 'private',
		});
		expect(logEvent).toHaveBeenNthCalledWith(1, analytics, 'app_error', {
			...context,
			error_code: 'functions/unauthenticated',
			operation: 'create_account',
		});
		expect(logEvent).toHaveBeenNthCalledWith(2, analytics, 'app_error', {
			...context,
			error_code: 'unknown',
			operation: 'unknown',
		});
	});

	it('filters identifiers, unbounded categories, and context overrides at runtime', () => {
		const service = createService(analytics);
		const untrusted = {
			action: 'added' as const,
			childId: 42,
			email: 'private@example.com',
			language: 'private',
			program_year: 1999,
		};
		service.logEventWithParams('workspace_child_saved', untrusted);
		service.logEventWithParams('default_language', {
			value: 'private@example.com',
		} as never);
		expect(logEvent).toHaveBeenNthCalledWith(
			1,
			analytics,
			'workspace_child_saved',
			{ ...context, action: 'added' },
		);
		expect(logEvent).toHaveBeenNthCalledWith(
			2,
			analytics,
			'default_language',
			context,
		);
	});

	it('reads active language for each event after a language change', () => {
		const service = createService(analytics);
		service.logEvent('sign_up_started');
		currentLanguage.mockReturnValue('en');
		service.logEvent('account_created');
		expect(logEvent).toHaveBeenNthCalledWith(
			1,
			analytics,
			'sign_up_started',
			context,
		);
		expect(logEvent).toHaveBeenNthCalledWith(
			2,
			analytics,
			'account_created',
			{ ...context, language: 'en' },
		);
	});

	it('silently skips events when the SDK provider is absent', () => {
		const service = createService(null);
		service.logErrorEvent('functions/internal', 'private');
		service.logEvent('account_created');
		expect(logEvent).not.toHaveBeenCalled();
	});

	it('marks corrected event semantics even when optional context providers are absent', () => {
		TestBed.configureTestingModule({
			providers: [{ provide: FIREBASE_ANALYTICS, useValue: analytics }],
		});
		TestBed.inject(AnalyticsWrapper).logEvent('cancel_registration');
		expect(logEvent).toHaveBeenCalledWith(analytics, 'cancel_registration', {
			event_schema_version: 2, app_area: 'unknown', language: 'unknown',
		});
	});

	it('does not throw when SDK calls or context readers throw', () => {
		const service = createService(analytics);
		vi.mocked(logEvent).mockImplementation(() => {
			throw new Error('SDK unavailable');
		});
		expect(() => service.logEvent('sign_up_started')).not.toThrow();
		expect(() => service.logErrorEvent(null)).not.toThrow();
		currentLanguage.mockImplementation(() => {
			throw new Error('unavailable');
		});
		expect(() => service.logEvent('account_created')).not.toThrow();
	});

	it('rejects unsupported names and keeps every allowed name valid for GA4', () => {
		const service = createService(analytics);
		service.logEvent('functions/unauthenticated' as never);
		service.logEvent('constructor' as never);
		expect(logEvent).not.toHaveBeenCalled();
		for (const name of Object.keys(ANALYTICS_EVENTS)) {
			expect(name).toMatch(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/);
			expect(name).not.toMatch(/^(firebase_|google_|ga_)/);
		}
	});

	it.each([
		undefined,
		null,
		42,
		'private@example.com',
		new Error('private'),
		{ code: 'private' },
	])('collapses unknown errors without inspecting their message', (error) => {
		expect(analyticsErrorCode(error)).toBe('unknown');
	});

	it('tolerates errors with throwing code getters and SDK initialization failures', () => {
		expect(
			analyticsErrorCode({
				get code(): string {
					throw new Error('private');
				},
			}),
		).toBe('unknown');
		expect(
			optionalAnalytics(() => {
				throw new Error('disabled');
			}),
		).toBeNull();
		expect(optionalAnalytics(() => analytics)).toBe(analytics);
	});
});

describe('trackAnalyticsOperation', () => {
	it('reports success only after the operation resolves and returns its exact result', async () => {
		const reporter = { logEventWithParams: vi.fn() };
		let resolve!: (value: object) => void;
		const result = { data: true };
		const pending = trackAnalyticsOperation(
			reporter,
			'registration_cancel',
			() =>
				new Promise<object>((done) => {
					resolve = done;
				}),
		);
		expect(reporter.logEventWithParams.mock.calls).toEqual([
			[
				'workflow_action',
				{ operation: 'registration_cancel', outcome: 'attempted' },
			],
		]);
		resolve(result);
		await expect(pending).resolves.toBe(result);
		expect(reporter.logEventWithParams).toHaveBeenLastCalledWith(
			'workflow_action',
			{ operation: 'registration_cancel', outcome: 'succeeded' },
		);
	});

	it('reports a bounded failure and preserves the exact rejection', async () => {
		const reporter = { logEventWithParams: vi.fn() };
		const error = {
			code: 'functions/unavailable',
			message: 'private@example.com',
		};
		await expect(
			trackAnalyticsOperation(reporter, 'appointment_change', () =>
				Promise.reject(error),
			),
		).rejects.toBe(error);
		expect(reporter.logEventWithParams.mock.calls).toEqual([
			[
				'workflow_action',
				{ operation: 'appointment_change', outcome: 'attempted' },
			],
			[
				'workflow_action',
				{
					operation: 'appointment_change',
					outcome: 'failed',
					error_code: 'functions/unavailable',
				},
			],
		]);
	});

	it('preserves success and failure when every telemetry call throws', async () => {
		const reporter = {
			logEventWithParams: vi.fn(() => {
				throw new Error('SDK failed');
			}),
		};
		await expect(
			trackAnalyticsOperation(reporter, 'sign_in', () =>
				Promise.resolve(true),
			),
		).resolves.toBe(true);
		const error = new Error('original');
		await expect(
			trackAnalyticsOperation(reporter, 'sign_in', () =>
				Promise.reject(error),
			),
		).rejects.toBe(error);
	});
});
