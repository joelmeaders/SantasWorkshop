import { Injectable } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';

@Injectable({
	providedIn: 'root',
})
export class AnalyticsWrapper {
	constructor(private readonly analytics: Analytics) {}

	public readonly logErrorEvent = (errorCode: string, message?: string) =>
		message
			? logEvent(this.analytics, errorCode, { message })
			: logEvent(this.analytics, errorCode);

	public readonly logEvent = (eventName: string) =>
		logEvent(this.analytics, eventName);
}
