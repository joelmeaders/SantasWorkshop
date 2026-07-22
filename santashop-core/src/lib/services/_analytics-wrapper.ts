import { Injectable, inject } from '@angular/core';
import { logEvent } from 'firebase/analytics';
import { FIREBASE_ANALYTICS } from '../tokens';

@Injectable({
	providedIn: 'root',
})
export class AnalyticsWrapper {
	private readonly analytics = inject(FIREBASE_ANALYTICS);

	public readonly logErrorEvent = (
		errorCode: string,
		message?: string,
	): void =>
		message
			? logEvent(this.analytics, errorCode, { message })
			: logEvent(this.analytics, errorCode);

	public readonly logEvent = (eventName: string): void =>
		logEvent(this.analytics, eventName);

	public readonly logEventWithParams = (
		eventName: string,
		eventParams?: Record<string, any>,
	): void => logEvent(this.analytics, eventName, eventParams);
}
