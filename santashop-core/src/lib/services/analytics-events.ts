/** Only bounded categories belong in analytics. Never add account or child data. */
const operations = [
	'create_account',
	'signup_sign_in',
	'sign_in',
	'password_reset_request',
	'child_save',
	'child_remove',
	'appointment_select',
	'registration_review',
	'registration_submit',
	'registration_cancel',
	'appointment_change',
	'email_update',
	'profile_update',
	'password_update',
	'unknown',
] as const;

const errorReasons = [
	'cancelled',
	'unknown',
	'invalid-argument',
	'deadline-exceeded',
	'not-found',
	'already-exists',
	'permission-denied',
	'resource-exhausted',
	'failed-precondition',
	'aborted',
	'out-of-range',
	'unimplemented',
	'internal',
	'unavailable',
	'data-loss',
	'unauthenticated',
	'network-request-failed',
	'invalid-credential',
	'invalid-email',
	'user-disabled',
	'user-not-found',
	'wrong-password',
	'too-many-requests',
	'email-already-in-use',
	'weak-password',
	'requires-recent-login',
	'operation-not-allowed',
	'sign-in-failed',
	'password-reset-failed',
] as const;

const errorCodes = [
	'unknown',
	...errorReasons.flatMap((reason) =>
		['auth', 'functions', 'firestore', 'storage'].map(
			(source) => `${source}/${reason}`,
		),
	),
] as const;

export type AnalyticsOperation = (typeof operations)[number];

/** The same schema controls TypeScript call sites and runtime parameter filtering. */
export const ANALYTICS_EVENTS = {
	app_error: { error_code: errorCodes, operation: operations },
	workflow_action: {
		operation: operations,
		outcome: ['attempted', 'succeeded', 'failed'],
		error_code: errorCodes,
	},
	sign_up_started: {},
	account_created: {},
	signup_recovery_shown: { reason: ['account_exists', 'sign_in_failed'] },
	signup_recovery_selected: { action: ['reset', 'sign_in', 'dismissed'] },
	email_confirmation_dialog: { outcome: ['confirmed', 'dismissed'] },
	confirmed_email: {},
	default_language: { value: ['en', 'es'] },
	viewed_privacypolicy: {},
	viewed_termsofservice: {},
	registration_record_unavailable: { reason: ['missing', 'unreadable'] },
	workspace_child_saved: { action: ['added', 'edited'] },
	workspace_child_removed: {},
	workspace_appointment_saved: {},
	workspace_review_started: {},
	workspace_appointment_review_required: {},
	workspace_review_changes: {},
	workspace_review_resumed: {},
	submit_registration: {},
	workspace_email_updated: {},
	workspace_completion_nudge_clicked: {},
	cancel_registration: {},
	change_registration_datetime: {},
	profile_update_info: {},
	profile_update_email: {},
	profile_update_password: {},
	admin_registration_scan: {
		disposition: [
			'not-found',
			'incomplete',
			'eligible',
			'cancelled',
			'duplicate-accidental',
			'duplicate-risk',
		],
		time_category: ['within_5_minutes', 'over_5_minutes', 'not_applicable'],
	},
	admin_blocked_scan_view: {
		disposition: ['cancelled', 'duplicate-accidental', 'duplicate-risk'],
	},
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsEventParams<Name extends AnalyticsEventName> =
	keyof (typeof ANALYTICS_EVENTS)[Name] extends never
		? Record<string, never>
		: {
				[Key in keyof (typeof ANALYTICS_EVENTS)[Name]]?:
					(typeof ANALYTICS_EVENTS)[Name][Key] extends readonly (infer Value)[]
						? Value : never;
			};

/** Unknown or user-supplied codes collapse to a fixed category. Messages are ignored. */
export function analyticsErrorCode(error: unknown): string {
	try {
		const code =
			typeof error === 'string'
				? error
				: typeof error === 'object' && error !== null && 'code' in error
					? error.code
					: undefined;
		return typeof code === 'string' && errorCodes.includes(code)
			? code
			: 'unknown';
	} catch {
		return 'unknown';
	}
}

export function analyticsParameters(
	eventName: AnalyticsEventName,
	parameters?: object,
): Record<string, string> {
	const schema: Record<string, readonly string[]> =
		ANALYTICS_EVENTS[eventName];
	const clean: Record<string, string> = {};
	for (const [key, choices] of Object.entries(schema)) {
		const value: unknown =
			parameters && key in parameters
				? (parameters as Record<string, unknown>)[key]
				: undefined;
		if (typeof value === 'string' && choices.includes(value))
			clean[key] = value;
	}
	return clean;
}

export interface AnalyticsOperationReporter {
	logEventWithParams: <Name extends AnalyticsEventName>(
		eventName: Name,
		eventParams?: AnalyticsEventParams<Name>,
	) => void;
}

/** Observe only the operation promise. UI refreshes and navigation have separate outcomes. */
export async function trackAnalyticsOperation<Result>(
	analytics: AnalyticsOperationReporter,
	operation: AnalyticsOperation,
	action: () => Promise<Result>,
): Promise<Result> {
	const report = (
		outcome: 'attempted' | 'succeeded' | 'failed',
		error?: unknown,
	): void => {
		try {
			analytics.logEventWithParams('workflow_action', {
				operation,
				outcome,
				...(outcome === 'failed'
					? { error_code: analyticsErrorCode(error) }
					: {}),
			});
		} catch {
			// Telemetry must never change the operation result.
		}
	};
	report('attempted');
	try {
		const result = await action();
		report('succeeded');
		return result;
	} catch (error) {
		report('failed', error);
		throw error;
	}
}
