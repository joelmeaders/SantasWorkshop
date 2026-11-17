import { createHash } from 'node:crypto';
import { SendEmailCommand, type SESClientConfig } from '@aws-sdk/client-ses';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import {
	isEmailSink,
	recordSimulatedEmail,
} from '../../../scripts/load/functions/email-isolation';
import { registrationReviewEnabled } from './registrationReviewAccess';
import { COLLECTION_SCHEMA, type Registration } from '../models';
import { isEmailSendingEnabled } from '../utility/email-sending';
import {
	createEmailSendClient,
	emailSendOptions,
} from '../utility/email-transport';
import {
	REGISTRATION_EMAIL_RETURN_PATH,
	REGISTRATION_EMAIL_SOURCE,
	SES_REGION,
} from '../utility/runtime-config';
import { getRegistrationReviewDenylist } from '../utility/registration-review-denylist-access';
import {
	REVIEW_REPLY_TO,
	type ReviewEmailAction,
} from '../utility/registration-review-email';

type DeliveryState =
	| 'queued'
	| 'sending'
	| 'superseded'
	| 'sent'
	| 'uncertain'
	| 'suppressed'
	| 'simulated';
const MAX_AGE_MS = 30 * 60_000;

interface ReviewEmailJob {
	state: DeliveryState;
	action: ReviewEmailAction;
	caseId: string;
	registrationId: string;
	recipient: string;
	replyTo: string;
	subject: string;
	text: string;
	html: string;
	cancellationLogId?: string;
	operationId?: string;
	qrcode?: string;
}
interface DeliveryDependencies {
	enabled(): Promise<boolean>;
	isSink(): boolean;
	sink(payload: unknown, receiptKey: string): Promise<string>;
	send(command: SendEmailCommand): Promise<string | undefined>;
}
let sesClient: ReturnType<typeof createEmailSendClient> | undefined;
const defaults: DeliveryDependencies = {
	enabled: isEmailSendingEnabled,
	isSink: isEmailSink,
	sink: (payload, receiptKey) =>
		recordSimulatedEmail('registration', payload, receiptKey),
	send: async (command) => {
		sesClient ??= createEmailSendClient({
			credentials: {
				accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
				secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
			},
			region: SES_REGION,
		} as SESClientConfig);
		return (await sesClient.send(command, emailSendOptions())).MessageId;
	},
};

function matchesCurrentState(
	job: ReviewEmailJob,
	registration: Registration | undefined,
	accessDisabled: boolean,
	matchesDenylistPolicy: boolean,
): boolean {
	if (
		!registration ||
		registration.emailAddress?.trim().toLowerCase() !== job.recipient
	)
		return false;
	switch (job.action) {
		case 'cancel':
			return (
				!!registration.cancelledOn &&
				!!job.cancellationLogId &&
				registration.cancellationLogId === job.cancellationLogId
			);
		case 'reinstate':
			return (
				!!registration.registrationSubmittedOn &&
				!registration.cancelledOn &&
				registration.qrcode === job.qrcode
			);
		case 'disable':
			return accessDisabled;
		case 'enable':
			return !accessDisabled;
		case 'blacklist':
		case 'unblacklist':
			return matchesDenylistPolicy;
		default:
			return true;
	}
}

export default async function sendRegistrationReviewEmail(
	trigger: QueryDocumentSnapshot,
	eventTime: string,
	deps: DeliveryDependencies = defaults,
	now: Date = new Date(),
): Promise<void> {
	const ref = trigger.ref;
	const db = ref.firestore;
	const ageMs = now.getTime() - Date.parse(eventTime);
	const isNewEvent =
		Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_MS;
	const setOutcome = async (
		state: DeliveryState,
		deliveryId?: string,
	): Promise<void> => {
		await db.runTransaction(async (tx) => {
			const snapshot = await tx.get(ref);
			// A cleared annual record must never be recreated.
			if (snapshot.get('state') !== 'sending') return;
			tx.update(ref, {
				state,
				completedOn: now,
				...(deliveryId ? { deliveryId } : {}),
			});
		});
	};
	const allowed =
		isNewEvent && registrationReviewEnabled() && (await deps.enabled());
	const sink = allowed && deps.isSink();
	// Emulator real email is never enabled for this worker. An explicitly configured sink is allowed.
	const deliveryAllowed =
		allowed && (process.env['FUNCTIONS_EMULATOR'] !== 'true' || sink);
	const job = await db.runTransaction(
		async (tx): Promise<ReviewEmailJob | undefined> => {
			const snapshot = await tx.get(ref);
			const latest = snapshot.data() as ReviewEmailJob | undefined;
			if (!latest || latest.state !== 'queued') return undefined;
			if (!deliveryAllowed || latest.replyTo !== REVIEW_REPLY_TO) {
				tx.update(ref, { state: 'suppressed', completedOn: now });
				return undefined;
			}
			const [registration, access] = await tx.getAll(
				db
					.collection(COLLECTION_SCHEMA.registrations)
					.doc(latest.registrationId),
				db
					.collection(COLLECTION_SCHEMA.shopperAccess)
					.doc(latest.registrationId),
			);
			let matchesDenylistPolicy = false;
			if (
				(latest.action === 'blacklist' ||
					latest.action === 'unblacklist') &&
				latest.operationId
			) {
				const policy = getRegistrationReviewDenylist(db);
				if (policy) {
					const [marker, emailBlocked, uidBlocked] =
						await Promise.all([
							tx.get(
								db
									.collection(
										'registrationReviewAuthOperations',
									)
									.doc(latest.registrationId),
							),
							policy.isEmailBlocked(latest.recipient, tx),
							policy.isUidBlocked(latest.registrationId, tx),
						]);
					const block = latest.action === 'blacklist';
					matchesDenylistPolicy =
						marker.get('operationId') === latest.operationId &&
						marker.get('state') ===
							(block ? 'confirmed' : 'cleared') &&
						emailBlocked === block &&
						uidBlocked === block;
				}
			}
			if (
				!matchesCurrentState(
					latest,
					registration.data() as Registration | undefined,
					access.get('disabled') === true,
					matchesDenylistPolicy,
				)
			) {
				tx.update(ref, { state: 'superseded', completedOn: now });
				return undefined;
			}
			tx.update(ref, { state: 'sending', claimedOn: now });
			return latest;
		},
	);
	if (!job) return;

	const command = new SendEmailCommand({
		Destination: { ToAddresses: [job.recipient] },
		ReplyToAddresses: [REVIEW_REPLY_TO],
		Source: REGISTRATION_EMAIL_SOURCE,
		ReturnPath: REGISTRATION_EMAIL_RETURN_PATH,
		Message: {
			Subject: { Charset: 'UTF-8', Data: job.subject },
			Body: {
				Text: { Charset: 'UTF-8', Data: job.text },
				Html: { Charset: 'UTF-8', Data: job.html },
			},
		},
	});
	try {
		if (sink) {
			const receipt = createHash('sha256').update(ref.path).digest('hex');
			const deliveryId = await deps.sink(command.input, receipt);
			await setOutcome('simulated', deliveryId);
		} else {
			const deliveryId = await deps.send(command);
			await setOutcome(deliveryId ? 'sent' : 'uncertain', deliveryId);
		}
	} catch {
		// Provider acceptance may precede a lost response. Never send again automatically.
		await setOutcome('uncertain');
	}
}
