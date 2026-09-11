import { Injectable, InjectionToken, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { logEvent } from 'firebase/analytics';
import { FIREBASE_ANALYTICS, PROGRAM_YEAR } from '../tokens';
import {
	ANALYTICS_EVENTS,
	AnalyticsEventName,
	AnalyticsEventParams,
	AnalyticsOperation,
	analyticsErrorCode,
	analyticsParameters,
} from './analytics-events';

export * from './analytics-events';

export const ANALYTICS_APP_AREA = new InjectionToken<'customer' | 'admin'>(
	'analytics-app-area',
);

/** Analytics is optional, including in browsers that reject SDK initialization. */
export function optionalAnalytics<Result>(
	initialize: () => Result,
): Result | null {
	try {
		return initialize();
	} catch {
		return null;
	}
}

@Injectable({
	providedIn: 'root',
})
export class AnalyticsWrapper {
	private readonly analytics = inject(FIREBASE_ANALYTICS, {
		optional: true,
	});
	private readonly appArea = inject(ANALYTICS_APP_AREA, { optional: true });
	private readonly programYear = inject(PROGRAM_YEAR, { optional: true });
	private readonly translate = inject(TranslateService, { optional: true });

	public readonly logErrorEvent = (
		errorCode: unknown,
		_legacyMessage?: string,
		operation: AnalyticsOperation = 'unknown',
	): void => {
		this.logEventWithParams('app_error', {
			error_code: analyticsErrorCode(errorCode),
			operation,
		});
	};

	public readonly logEvent = (eventName: AnalyticsEventName): void => {
		this.logEventWithParams(eventName);
	};

	public readonly logEventWithParams = <Name extends AnalyticsEventName>(
		eventName: Name,
		eventParams?: AnalyticsEventParams<Name>,
	): void => {
		try {
			if (!this.analytics || !Object.hasOwn(ANALYTICS_EVENTS, eventName))
				return;
			const language = this.translate?.getCurrentLang();
			logEvent(this.analytics, eventName, {
				...analyticsParameters(eventName, eventParams),
				event_schema_version: 2,
				app_area: this.appArea ?? 'unknown',
				language:
					language === 'es'
						? 'es'
						: language === 'en' || this.appArea === 'admin'
							? 'en'
							: 'unknown',
				...(typeof this.programYear === 'number' &&
				Number.isInteger(this.programYear) &&
				this.programYear >= 2000 &&
				this.programYear <= 2100
					? { program_year: this.programYear }
					: {}),
			});
		} catch {
			// Analytics availability must never block application behavior.
		}
	};
}
