import { createHmac } from 'node:crypto';
import type {
	DocumentReference,
	Firestore,
	Transaction,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export type ReviewDenylistIntent = Readonly<{
	kind: 'block' | 'unblock';
	email: string;
	shopperUid: string;
	actorUid: string;
	caseId: string;
	cancellationId: string;
	reason: string;
	operationId: string;
}>;

type DenylistScope = {
	readonly emailKey: string;
	readonly shopperUid: string;
	readonly caseId: string;
	readonly cancellationId: string;
	readonly active: boolean;
};

// For a replay, active is the original outcome, not the current state.
// Check isEmailBlocked/isUidBlocked before any separate enforcement work.
type DenylistResult = { readonly active: boolean; readonly replayed: boolean };

// Private, server-only, cross-season collections. No Function or Firebase Auth
// integration imports this store yet. Do not add these paths to seasonal purge.
export function createRegistrationReviewDenylist(
	db: Firestore,
	secret: Buffer,
): {
	isEmailBlocked: (email: string, tx?: Transaction) => Promise<boolean>;
	isUidBlocked: (uid: string, tx?: Transaction) => Promise<boolean>;
	apply: (
		tx: Transaction,
		intent: ReviewDenylistIntent,
	) => Promise<DenylistResult>;
} {
	if (secret.length < 32)
		throw new Error('Review denylist key must be at least 32 bytes.');
	const key = Buffer.from(secret);
	const digest = (domain: string, value: string): string =>
		createHmac('sha256', key)
			.update(domain)
			.update('\0')
			.update(value)
			.digest('hex');
	const emailRef = (emailKey: string): DocumentReference =>
		db.collection('registrationReviewEmailBlocks').doc(emailKey);
	const uidRef = (uid: string): DocumentReference =>
		db.collection('registrationReviewUidBlocks').doc(identifier(uid));
	const get = (ref: DocumentReference, tx?: Transaction): Promise<boolean> =>
		(tx ? tx.get(ref) : ref.get()).then(
			(snapshot) => snapshot.get('active') === true,
		);
	const emailKeyFor = (email: string): string =>
		digest('email-v1', normalizeEmail(email));

	return {
		isEmailBlocked: (email, tx) => get(emailRef(emailKeyFor(email)), tx),
		isUidBlocked: (uid, tx) => get(uidRef(uid), tx),
		// The caller authenticates an Owner, loads and verifies authoritative case,
		// cancellation and Auth email in the same operation, then calls apply before
		// staging other Firestore writes. This store never mutates Firebase Auth.
		apply: async (tx, intent) => {
			const emailKey = emailKeyFor(intent.email);
			const shopperUid = identifier(intent.shopperUid);
			const actorUid = identifier(intent.actorUid);
			const caseId = identifier(intent.caseId);
			const cancellationId = identifier(intent.cancellationId);
			const reason = intent.reason.trim();
			if (!reason || reason.length > 500 || actorUid === shopperUid) {
				throw new HttpsError(
					'invalid-argument',
					'Invalid review block details.',
				);
			}

			const blockRef = emailRef(emailKey);
			const markerRef = uidRef(shopperUid);
			const auditRef = db
				.collection('registrationReviewBlockAudit')
				.doc(identifier(intent.operationId));
			const binding = { emailKey, shopperUid, caseId, cancellationId };
			const fingerprint = digest(
				'operation-v1',
				JSON.stringify([intent.kind, binding, actorUid, reason]),
			);
			const [block, marker, previous] = await tx.getAll(
				blockRef,
				markerRef,
				auditRef,
			);
			if (!block || !marker || !previous) {
				throw new HttpsError(
					'internal',
					'Could not read review block records.',
				);
			}
			if (previous.exists) {
				if (previous.get('fingerprint') !== fingerprint) {
					throw new HttpsError(
						'already-exists',
						'The review operation ID is already in use.',
					);
				}
				return {
					active: previous.get('active') === true,
					replayed: true,
				};
			}

			if (intent.kind === 'block') {
				if (
					block.get('active') === true ||
					marker.get('active') === true
				) {
					throw new HttpsError(
						'failed-precondition',
						'A review block is already active.',
					);
				}
			} else if (
				!matchesActive(
					block.data() as DenylistScope | undefined,
					binding,
				) ||
				!matchesActive(
					marker.data() as DenylistScope | undefined,
					binding,
				)
			) {
				throw new HttpsError(
					'failed-precondition',
					'The active review block changed.',
				);
			}

			const active = intent.kind === 'block';
			const at = new Date();
			const state = { ...binding, active, actorUid, updatedAt: at };
			tx.set(blockRef, state);
			tx.set(markerRef, state);
			tx.create(auditRef, {
				...state,
				kind: intent.kind,
				reason,
				fingerprint,
			});
			return { active, replayed: false };
		},
	};
}

function matchesActive(
	state: DenylistScope | undefined,
	binding: Omit<DenylistScope, 'active'>,
): boolean {
	return (
		state?.active === true &&
		state.emailKey === binding.emailKey &&
		state.shopperUid === binding.shopperUid &&
		state.caseId === binding.caseId &&
		state.cancellationId === binding.cancellationId
	);
}

function identifier(value: string): string {
	if (!/^[A-Za-z0-9_-]{1,128}$/u.test(value)) {
		throw new HttpsError('invalid-argument', 'Invalid review record ID.');
	}
	return value;
}

function normalizeEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/u.test(email)) {
		throw new HttpsError('invalid-argument', 'Invalid shopper email.');
	}
	return email;
}
