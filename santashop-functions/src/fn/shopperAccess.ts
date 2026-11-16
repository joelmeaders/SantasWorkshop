import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import admin from '../firebase-admin';
import {
	COLLECTION_SCHEMA,
	SHOPPER_ACCESS_REASONS,
	type AdminShopperAccessStatus,
	type Registration,
	type ShopperAccessAudit,
	type ShopperAccessReason,
	type ShopperAccessStatus,
} from '../models';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import { canCheckInToken, isAdminToken } from '../utility/capabilities';
import { getErrorCode } from '../utility/errors';
import { requireObject, requireOnlyKeys } from './registrationMutationSupport';

const accessRef = (uid: string): admin.firestore.DocumentReference =>
	admin.firestore().collection(COLLECTION_SCHEMA.shopperAccess).doc(uid);

export async function getShopperAccessStatus(
	request: CallableRequest<unknown>,
): Promise<ShopperAccessStatus> {
	const uid = requireAuthenticatedUid(request);
	const disabled = (await accessRef(uid).get()).data()?.['disabled'] === true;
	if (!disabled) return { disabled, hasActiveRegistration: false };
	const registration = (
		await admin
			.firestore()
			.collection(COLLECTION_SCHEMA.registrations)
			.doc(uid)
			.get()
	).data() as Registration | undefined;
	return {
		disabled,
		hasActiveRegistration: Boolean(
			registration?.registrationSubmittedOn &&
			!registration.cancelledOn &&
			!registration.hasCheckedIn,
		),
	};
}

function requireDocumentId(value: unknown): string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
		throw new HttpsError(
			'invalid-argument',
			'The record identifier is invalid.',
		);
	}
	return value;
}

function requireShopperAccessAdmin(request: CallableRequest<unknown>): string {
	const uid = requireAuthenticatedUid(request);
	if (!isAdminToken(request.auth?.token)) {
		throw new HttpsError('permission-denied', 'Admin access is required.');
	}
	return uid;
}

export async function getAdminShopperAccess(
	request: CallableRequest<unknown>,
): Promise<AdminShopperAccessStatus> {
	requireShopperAccessAdmin(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['uid']);
	const ref = accessRef(requireDocumentId(data['uid']));
	const [state, audit] = await admin
		.firestore()
		.getAll(ref, ref.collection('audit').doc('current'));
	const disabled = state.data()?.['disabled'] === true;
	const review = audit.data() as
		| (Omit<ShopperAccessAudit, 'updatedAt'> & {
				updatedAt: admin.firestore.Timestamp;
		  })
		| undefined;
	return {
		disabled,
		audit: review
			? {
					disabled: review.disabled,
					reason: review.reason,
					evidenceId: review.evidenceId,
					disposition: review.disposition,
					updatedBy: review.updatedBy,
					updatedAt: review.updatedAt.toDate().toISOString(),
				}
			: null,
	};
}

export async function setShopperAccess(
	request: CallableRequest<unknown>,
): Promise<{ disabled: boolean }> {
	const actorUid = requireShopperAccessAdmin(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['uid', 'disabled', 'reason', 'evidenceId']);
	const uid = requireDocumentId(data['uid']);
	const disabled = data['disabled'];
	if (typeof disabled !== 'boolean') {
		throw new HttpsError(
			'invalid-argument',
			'Choose whether to disable shopper access.',
		);
	}
	const reason = data['reason'] as ShopperAccessReason;
	if (
		(disabled && !SHOPPER_ACCESS_REASONS.includes(reason)) ||
		(!disabled &&
			(reason !== undefined || data['evidenceId'] !== undefined))
	) {
		throw new HttpsError(
			'invalid-argument',
			'Choose a valid disable reason.',
		);
	}
	const evidenceId =
		data['evidenceId'] === undefined
			? null
			: requireDocumentId(data['evidenceId']);
	const target = await admin
		.auth()
		.getUser(uid)
		.catch((error: unknown) => {
			if (getErrorCode(error) === 'auth/user-not-found') {
				throw new HttpsError('not-found', 'Shopper account not found.');
			}
			throw error;
		});
	const claims = target.customClaims;
	if (
		uid === actorUid ||
		canCheckInToken(claims) ||
		claims?.['admin'] === true ||
		claims?.['checkin'] === true
	) {
		throw new HttpsError(
			'permission-denied',
			'Staff accounts must use staff account tools.',
		);
	}

	const db = admin.firestore();
	const ref = accessRef(uid);
	const audit = ref.collection('audit').doc('current');
	await db.runTransaction(async (transaction) => {
		const [current, priorAudit, user, staff, registration] =
			await Promise.all([
				transaction.get(ref),
				transaction.get(audit),
				transaction.get(
					db.collection(COLLECTION_SCHEMA.users).doc(uid),
				),
				transaction.get(
					db.collection(COLLECTION_SCHEMA.staff).doc(uid),
				),
				transaction.get(
					db.collection(COLLECTION_SCHEMA.registrations).doc(uid),
				),
			]);
		if (staff.exists) {
			throw new HttpsError(
				'permission-denied',
				'Staff accounts must use staff account tools.',
			);
		}
		if (!user.exists) {
			throw new HttpsError('not-found', 'Shopper profile not found.');
		}
		if (disabled && !registration.data()?.['registrationSubmittedOn']) {
			throw new HttpsError(
				'failed-precondition',
				'A submitted registration is required.',
			);
		}
		if ((current.data()?.['disabled'] === true) === disabled) return;
		if (evidenceId) {
			const evidence = await transaction.get(
				db
					.collection(COLLECTION_SCHEMA.registrationScanAttempts)
					.doc(evidenceId),
			);
			if (evidence.data()?.['customerId'] !== uid) {
				throw new HttpsError(
					'invalid-argument',
					'The evidence does not belong to this shopper.',
				);
			}
		}
		const previous = priorAudit.data();
		const record = {
			disabled,
			reason: disabled ? reason : (previous?.['reason'] ?? null),
			evidenceId: disabled
				? evidenceId
				: (previous?.['evidenceId'] ?? null),
			disposition: disabled ? 'disabled' : 'reviewed-and-cleared',
			updatedBy: actorUid,
			updatedAt: new Date(),
		};
		transaction.set(ref, { disabled });
		transaction.set(audit, record);
		transaction.create(ref.collection('audit').doc(), record);
	});
	return { disabled };
}
