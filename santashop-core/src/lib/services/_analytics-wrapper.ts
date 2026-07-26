import { Injectable, inject } from '@angular/core';
import { logEvent } from 'firebase/analytics';
import { FIREBASE_ANALYTICS } from '../tokens';

@Injectable({
	providedIn: 'root',
})
export class AnalyticsWrapper {
	private readonly analytics = inject(FIREBASE_ANALYTICS, {
		optional: true,
	});

	public readonly logErrorEvent = (
		errorCode: string,
		message?: string,
	): void => {
		if (!this.analytics) {
			return;
		}

		if (message) {
			logEvent(this.analytics, errorCode, { message });
			return;
		}

		logEvent(this.analytics, errorCode);
	};

	public readonly logEvent = (eventName: string): void => {
		if (!this.analytics) {
			return;
		}

		logEvent(this.analytics, eventName);
	};

	public readonly logEventWithParams = (
		eventName: string,
		eventParams?: Record<string, any>,
	): void => {
		if (!this.analytics) {
			return;
		}

		logEvent(this.analytics, eventName, eventParams);
	};
}
