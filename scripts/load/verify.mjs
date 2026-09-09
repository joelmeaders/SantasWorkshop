import { firestoreBase, decodeFields, query } from './google.mjs';
import { delay } from './metrics.mjs';

export async function document(client, path) {
	const doc = await client.request(`${firestoreBase}/${path}`, {
		allow404: true,
	});
	return doc ? decodeFields(doc.fields) : undefined;
}

/** Read-only recovery: account intents remain discoverable even if onboarding lost its response. */
export async function verifyRun(
	client,
	journal,
	slotId,
	{ waitMs = 720_000, emailWaitMs = 300_000 } = {},
) {
	const intents = journal.events.filter((e) => e.type === 'account-intent');
	const completions = new Set(
		journal.events
			.filter((e) => e.type === 'registration-completed')
			.map((e) => e.uid),
	);
	const expectedCheckins = new Map(
		journal.events
			.filter((e) => e.type === 'checkin-completed')
			.map((e) => [e.uid, e]),
	);
	const problems = [];
	const owned = new Map();
	for (const intent of intents) {
		const matches = await query(client, 'registrations', [
			['emailAddress', 'EQUAL', intent.emailAddress],
		]);
		if (matches.length !== 1) {
			problems.push(
				`${intent.fixture}: expected one registration, found ${matches.length}.`,
			);
			continue;
		}
		owned.set(matches[0].id, matches[0]);
	}
	const codes = new Set();
	for (const [uid, registration] of owned) {
		if (registration.registrationSubmittedOn) completions.add(uid);
		if (!registration.qrcode || codes.has(registration.qrcode))
			problems.push(`${uid}: missing or duplicated confirmation code.`);
		codes.add(registration.qrcode);
	}
	for (const intent of journal.events.filter(
		(event) => event.type === 'checkin-intent',
	)) {
		if (intent.onsite) {
			const matches = await query(client, 'onsiteregistrations', [
				['emailAddress', 'EQUAL', intent.emailAddress],
			]);
			if (matches.length !== 1)
				problems.push(
					`${intent.emailAddress}: on-site intent has ${matches.length} business records.`,
				);
			else if (!expectedCheckins.has(matches[0].id)) {
				problems.push(
					`${matches[0].id}: on-site request committed without a recorded client success.`,
				);
				expectedCheckins.set(matches[0].id, {
					...intent,
					uid: matches[0].id,
				});
			}
		} else if (!expectedCheckins.has(intent.uid)) {
			problems.push(
				`${intent.uid}: check-in intent has no recorded client success.`,
			);
			expectedCheckins.set(intent.uid, intent);
		}
	}
	for (const uid of completions) {
		const registration = owned.get(uid);
		if (
			!registration?.registrationSubmittedOn ||
			registration.children?.length !== 3 ||
			!registration.qrCodeStoragePath?.startsWith(
				`registrations/${uid}/`,
			) ||
			!registration.qrCodeGeneratedOn
		)
			problems.push(
				`${uid}: completion, children, or QR state is invalid.`,
			);
		const index = await document(client, `registrationsearchindex/${uid}`);
		if (index?.customerId !== uid || index?.code !== registration?.qrcode)
			problems.push(`${uid}: search index does not match QR ownership.`);
	}
	for (const [uid, expected] of expectedCheckins) {
		const checkin = await document(client, `checkins/${uid}`);
		if (
			checkin?.stats?.children !== 3 ||
			!checkin?.checkInDateTime ||
			!checkin.inStats
		)
			problems.push(`${uid}: check-in or coupon count is invalid.`);
		if (
			expected.originalCheckInAt &&
			checkin?.checkInDateTime !== expected.originalCheckInAt
		)
			problems.push(`${uid}: original check-in was replaced.`);
		if (expected.edit) {
			const edit = await document(client, `editedregistrations/${uid}`);
			if (edit?.children?.[0]?.firstName !== 'Edited')
				problems.push(`${uid}: staff edit was not retained.`);
		}
		if (expected.onsite) {
			const matches = await query(client, 'onsiteregistrations', [
				['emailAddress', 'EQUAL', expected.emailAddress],
			]);
			if (matches.length !== 1 || matches[0].id !== uid)
				problems.push(
					`${uid}: duplicate or missing on-site registration.`,
				);
		} else if (!owned.get(uid)?.hasCheckedIn)
			problems.push(`${uid}: registration has no check-in flag.`);
	}
	const expectedSlots = [...owned.values()].filter(
		(reg) => reg.registrationSubmittedOn && reg.dateTimeSlot?.id === slotId,
	).length;
	const lastSubmissionAt = Math.max(
		0,
		...[...owned.values()].map(
			(reg) => Date.parse(reg.registrationSubmittedOn ?? '') || 0,
		),
	);
	const started = Date.now();
	let emailPending = [...completions];
	let slot;
	while (true) {
		const stillPending = [];
		for (const uid of emailPending) {
			const emails = await query(client, 'tmp_registrationemails', [
				['registrationUid', 'EQUAL', uid],
			]);
			if (emails.length !== 1) {
				stillPending.push(uid);
				continue;
			}
			const email = emails[0];
			if (
				email.deliveryState !== 'simulated' ||
				email.deliveryTransport !== 'test-sink' ||
				!email.deliverySinkReceiptId
			) {
				stillPending.push(uid);
				continue;
			}
			const receipt = await document(
				client,
				`emailSinkReceipts/${email.deliverySinkReceiptId}`,
			);
			if (
				!receipt?.simulated ||
				receipt.provider !== 'test-sink' ||
				!receipt.contentSha256 ||
				email.deliveryProviderAcceptedOn ||
				email.deliveryProviderMessageId
			)
				problems.push(`${uid}: simulated email receipt is invalid.`);
			if (
				!email.deliveryCompletedOn ||
				!email.queuedOn ||
				Date.parse(email.deliveryCompletedOn) -
					Date.parse(email.queuedOn) >
					emailWaitMs
			)
				problems.push(
					`${uid}: simulated email exceeded the five-minute delivery window.`,
				);
		}
		emailPending = stillPending;
		slot = await document(client, `dateTimeSlots/${slotId}`);
		if (
			(!emailPending.length && slot?.slotsReserved === expectedSlots) ||
			Date.now() - started >= waitMs
		)
			break;
		if (emailPending.length && Date.now() - started >= emailWaitMs) {
			problems.push(
				`Simulated email did not drain within five minutes: ${emailPending.length}.`,
			);
			break;
		}
		await delay(15_000);
	}
	if (slot?.slotsReserved !== expectedSlots)
		problems.push(
			`Slot counter expected ${expectedSlots}, observed ${slot?.slotsReserved ?? 'missing'}.`,
		);
	if (
		expectedSlots &&
		(!slot?.lastUpdated ||
			Date.parse(slot.lastUpdated) > lastSubmissionAt + 720_000)
	)
		problems.push(
			'Counter reconciliation exceeded two scheduler intervals plus two minutes.',
		);
	if (
		emailPending.length &&
		!problems.some((p) => p.startsWith('Simulated email'))
	)
		problems.push(
			`Simulated email remains pending: ${emailPending.length}.`,
		);
	const report = {
		checkedAt: new Date().toISOString(),
		passed: !problems.length,
		accounts: intents.length,
		registrations: owned.size,
		completedRegistrations: completions.size,
		checkedIn: expectedCheckins.size,
		expectedCoupons: expectedCheckins.size * 3,
		expectedSlots,
		observedSlots: slot?.slotsReserved,
		emailPending: emailPending.length,
		problems,
	};
	journal.record({ type: 'verification', ...report });
	return report;
}
