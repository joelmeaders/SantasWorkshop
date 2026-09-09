import { createHash } from 'node:crypto';
import {
	SendEmailCommand,
	SESClient,
	type SESClientConfig,
} from '@aws-sdk/client-ses';
import {
	customerLanguageOrEnglish,
	type CustomerLanguage,
} from '@santashop/models';
import type { CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	requireCallableData,
	requireEmailAddress,
	withCallableValidation,
} from '../utility/callable-validation';
import { getErrorCode } from '../utility/errors';
import { createFunctionLogger } from '../utility/observability';
import { isEmailSink, recordSimulatedEmail } from '../utility/email-isolation';
import {
	PASSWORD_RESET_CONTINUE_URL,
	REGISTRATION_EMAIL_RETURN_PATH,
	REGISTRATION_EMAIL_SOURCE,
	SES_REGION,
} from '../utility/runtime-config';

const log = createFunctionLogger('requestPasswordReset');
const RATE_LIMIT_COLLECTION = 'passwordResetRateLimits';
const RATE_LIMIT_INTERVAL_MS = 60_000;
const RATE_LIMIT_RECORD_LIFETIME_MS = 24 * 60 * 60 * 1000;
const ACCEPTED_RESPONSE = { accepted: true } as const;

const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined;

interface PasswordResetRequest {
	emailAddress: unknown;
}

interface PasswordResetRateLimitRecord {
	lastRequestedAt?: unknown;
}

const getSesClient = (): SESClient => {
	sesClient ??= new SESClient({
		credentials,
		region: SES_REGION,
	} as SESClientConfig);
	return sesClient;
};

const toDate = (value: unknown): Date | undefined => {
	if (value instanceof Date) return value;
	if (
		typeof value === 'object' &&
		value !== null &&
		'toDate' in value &&
		typeof value.toDate === 'function'
	) {
		const converted = value.toDate();
		return converted instanceof Date ? converted : undefined;
	}
	return undefined;
};

const escapeHtml = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

export const buildPasswordResetEmail = (
	resetLink: string,
	language: CustomerLanguage,
): { subject: string; text: string; html: string } => {
	const safeLink = escapeHtml(resetLink);
	if (language === 'es') {
		return {
			subject: 'Restablece tu contraseña de Denver Santa Claus Shop',
			text: `Recibimos una solicitud para restablecer tu contraseña de Denver Santa Claus Shop.\n\nRestablece tu contraseña: ${resetLink}\n\nSi no solicitaste este cambio, puedes ignorar este correo.`,
			html: `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.5"><h1 style="color:#b42318">Denver Santa Claus Shop</h1><p>Recibimos una solicitud para restablecer tu contraseña.</p><p><a href="${safeLink}" style="display:inline-block;background:#b42318;color:#fff;padding:12px 18px;text-decoration:none;border-radius:4px">Restablecer contraseña</a></p><p>Si no solicitaste este cambio, puedes ignorar este correo.</p></div>`,
		};
	}

	return {
		subject: 'Reset your Denver Santa Claus Shop password',
		text: `We received a request to reset your Denver Santa Claus Shop password.\n\nReset your password: ${resetLink}\n\nIf you did not request this change, you can ignore this email.`,
		html: `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.5"><h1 style="color:#b42318">Denver Santa Claus Shop</h1><p>We received a request to reset your password.</p><p><a href="${safeLink}" style="display:inline-block;background:#b42318;color:#fff;padding:12px 18px;text-decoration:none;border-radius:4px">Reset password</a></p><p>If you did not request this change, you can ignore this email.</p></div>`,
	};
};

const reserveRequest = async (
	emailHash: string,
	now: Date,
): Promise<boolean> => {
	const firestore = admin.firestore();
	const document = firestore.doc(`${RATE_LIMIT_COLLECTION}/${emailHash}`);

	return firestore.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(document);
		const existing = snapshot.data() as
			PasswordResetRateLimitRecord | undefined;
		const lastRequestedAt = toDate(existing?.lastRequestedAt);
		if (
			lastRequestedAt &&
			now.getTime() - lastRequestedAt.getTime() < RATE_LIMIT_INTERVAL_MS
		) {
			return false;
		}

		transaction.set(document, {
			lastRequestedAt: now,
			expiresAt: new Date(now.getTime() + RATE_LIMIT_RECORD_LIFETIME_MS),
		});
		return true;
	});
};

const loadPreferredLanguage = async (
	uid: string,
	requestKey: string,
): Promise<CustomerLanguage> => {
	try {
		const snapshot = await admin.firestore().doc(`users/${uid}`).get();
		return customerLanguageOrEnglish(
			snapshot.data()?.['preferredLanguage'],
		);
	} catch (error) {
		log.warn('Password reset profile lookup failed; using English', {
			requestKey,
			errorCode: getErrorCode(error),
		});
		return 'en';
	}
};

const sendPasswordResetEmail = async (
	emailAddress: string,
	resetLink: string,
	language: CustomerLanguage,
): Promise<void> => {
	const content = buildPasswordResetEmail(resetLink, language);
	if (isEmailSink()) {
		await recordSimulatedEmail('password-reset', content);
		return;
	}
	await getSesClient().send(
		new SendEmailCommand({
			Destination: { ToAddresses: [emailAddress] },
			Source: REGISTRATION_EMAIL_SOURCE,
			ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
			Message: {
				Subject: { Charset: 'UTF-8', Data: content.subject },
				Body: {
					Text: { Charset: 'UTF-8', Data: content.text },
					Html: { Charset: 'UTF-8', Data: content.html },
				},
			},
		}),
	);
};

export default async function requestPasswordReset(
	request: CallableRequest<PasswordResetRequest>,
): Promise<typeof ACCEPTED_RESPONSE> {
	const emailAddress = withCallableValidation(() => {
		const data = requireCallableData(request.data);
		return requireEmailAddress(data['emailAddress']);
	});
	const emailHash = createHash('sha256').update(emailAddress).digest('hex');
	const requestKey = emailHash.slice(0, 12);

	try {
		if (!(await reserveRequest(emailHash, new Date()))) {
			log.info('Password reset request rate limited', { requestKey });
			return ACCEPTED_RESPONSE;
		}
	} catch (error) {
		log.warn('Password reset rate-limit reservation failed', {
			requestKey,
			errorCode: getErrorCode(error),
		});
		return ACCEPTED_RESPONSE;
	}

	try {
		const authUser = await admin.auth().getUserByEmail(emailAddress);
		const language = await loadPreferredLanguage(authUser.uid, requestKey);
		const resetLink = await admin
			.auth()
			.generatePasswordResetLink(emailAddress, {
				url: PASSWORD_RESET_CONTINUE_URL,
			});

		if (
			process.env.FUNCTIONS_EMULATOR !== 'true' ||
			process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR === 'true'
		) {
			await sendPasswordResetEmail(emailAddress, resetLink, language);
		}
		log.info('Password reset request processed', {
			requestKey,
			language,
			emailDeliverySuppressed:
				isEmailSink() ||
				(process.env.FUNCTIONS_EMULATOR === 'true' &&
					process.env.SANTASHOP_SEND_EMAILS_FROM_EMULATOR !== 'true'),
		});
	} catch (error) {
		const errorCode = getErrorCode(error);
		if (errorCode === 'auth/user-not-found') {
			log.info('Password reset request processed for missing account', {
				requestKey,
			});
		} else {
			log.warn('Password reset provider operation failed', {
				requestKey,
				errorCode,
			});
		}
	}

	return ACCEPTED_RESPONSE;
}
