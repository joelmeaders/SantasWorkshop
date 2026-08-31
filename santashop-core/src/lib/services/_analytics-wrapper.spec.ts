import { TestBed } from '@angular/core/testing';
import { logEvent, type Analytics } from 'firebase/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_ANALYTICS } from '../tokens';
import { AnalyticsWrapper } from './_analytics-wrapper';

describe('AnalyticsWrapper', () => {
	const analytics = {} as Analytics;

	beforeEach(() => {
		vi.mocked(logEvent).mockReset();
	});

	const createService = (value: Analytics | null): AnalyticsWrapper => {
		TestBed.configureTestingModule({
			providers: [{ provide: FIREBASE_ANALYTICS, useValue: value }],
		});
		return TestBed.inject(AnalyticsWrapper);
	};

	it('logs errors with and without a message', () => {
		const service = createService(analytics);

		service.logErrorEvent('plain_error');
		service.logErrorEvent('described_error', 'Something failed');

		expect(logEvent).toHaveBeenNthCalledWith(1, analytics, 'plain_error');
		expect(logEvent).toHaveBeenNthCalledWith(
			2,
			analytics,
			'described_error',
			{ message: 'Something failed' },
		);
	});

	it('logs events with optional parameters', () => {
		const service = createService(analytics);

		service.logEvent('opened');
		service.logEventWithParams('saved', { source: 'unit-test' });

		expect(logEvent).toHaveBeenNthCalledWith(1, analytics, 'opened');
		expect(logEvent).toHaveBeenNthCalledWith(2, analytics, 'saved', {
			source: 'unit-test',
		});
	});

	it('silently skips analytics when the optional provider is absent', () => {
		const service = createService(null);

		service.logErrorEvent('error', 'message');
		service.logEvent('event');
		service.logEventWithParams('event_with_params', { value: true });

		expect(logEvent).not.toHaveBeenCalled();
	});
});
