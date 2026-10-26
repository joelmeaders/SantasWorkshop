import { SESClient, type SESClientConfig } from '@aws-sdk/client-ses';

// A timeout can follow provider acceptance. Never let SDK retries repeat a payload.
export const EMAIL_SEND_BUDGET_MS = 25_000;
export const createEmailSendClient = (config: SESClientConfig): SESClient =>
	new SESClient({
		...config,
		maxAttempts: 1,
		requestHandler: config.requestHandler ?? {
			connectionTimeout: 5_000,
			requestTimeout: 20_000,
		},
	});

export const emailSendOptions = (): { abortSignal: AbortSignal } => ({
	abortSignal: AbortSignal.timeout(EMAIL_SEND_BUDGET_MS),
});
