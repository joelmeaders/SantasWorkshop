import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFields, decode } from './google.mjs';
import { verifyRun } from './verify.mjs';

function fixture() {
	const at = new Date('2026-09-09T03:00:00Z');
	const completed = new Date(at.valueOf() + 5000);
	const store = {
		'registrations/parent': {
			uid: 'parent',
			emailAddress: 'load@example.invalid',
			qrcode: 'ABCD2345',
			children: [{}, {}, {}],
			registrationSubmittedOn: at,
			qrCodeStoragePath: 'registrations/parent/qr.png',
			qrCodeGeneratedOn: at,
			hasCheckedIn: true,
			dateTimeSlot: { id: 'load-slot' },
		},
		'registrationsearchindex/parent': {
			customerId: 'parent',
			code: 'ABCD2345',
		},
		'checkins/parent': {
			checkInDateTime: at,
			inStats: true,
			stats: { children: 3 },
		},
		'tmp_registrationemails/email': {
			registrationUid: 'parent',
			queuedOn: at,
			deliveryCompletedOn: completed,
			deliveryState: 'simulated',
			deliveryTransport: 'test-sink',
			deliverySinkReceiptId: 'registration-email',
		},
		'emailSinkReceipts/registration-email': {
			simulated: true,
			provider: 'test-sink',
			contentSha256: 'a'.repeat(64),
			completedOn: completed,
		},
		'dateTimeSlots/load-slot': { slotsReserved: 1, lastUpdated: completed },
	};
	const journal = {
		events: [
			{
				type: 'account-intent',
				fixture: 'one',
				emailAddress: 'Load@Example.Invalid',
			},
			{ type: 'registration-completed', uid: 'parent' },
			{
				type: 'checkin-completed',
				uid: 'parent',
				originalCheckInAt: at.toISOString(),
			},
		],
		record() {},
	};
	const client = {
		async request(url, options = {}) {
			if (url.endsWith(':runQuery')) {
				const q = options.body.structuredQuery;
				const name = q.from[0].collectionId;
				const filter = q.where.compositeFilter.filters[0].fieldFilter;
				return Object.entries(store)
					.filter(
						([path, data]) =>
							path.startsWith(`${name}/`) &&
							data[filter.field.fieldPath] ===
								decode(filter.value),
					)
					.map(([path, data]) => ({
						document: { name: path, fields: encodeFields(data) },
					}));
			}
			const key = url.split('/documents/')[1];
			return store[key]
				? { fields: encodeFields(store[key]) }
				: undefined;
		},
	};
	return { store, journal, client };
}

test('read-only recovery verifies business state and the real search-index collection', async () => {
	const { client, journal } = fixture();
	const report = await verifyRun(client, journal, 'load-slot', { waitMs: 0 });
	assert.deepEqual(report.problems, []);
	assert.equal(report.expectedCoupons, 3);
	assert.equal(report.registrations, 1);
});

test('verification catches altered original check-in, false SES acceptance and late sink delivery', async () => {
	const { client, journal, store } = fixture();
	store['checkins/parent'].checkInDateTime = new Date('2026-09-09T03:00:01Z');
	store['tmp_registrationemails/email'].deliveryProviderMessageId =
		'unexpected';
	store['tmp_registrationemails/email'].deliveryCompletedOn = new Date(
		'2026-09-09T03:06:00Z',
	);
	const report = await verifyRun(client, journal, 'load-slot', { waitMs: 0 });
	assert.equal(report.passed, false);
	assert.ok(
		report.problems.some((problem) =>
			problem.includes('original check-in'),
		),
	);
	assert.ok(
		report.problems.some((problem) =>
			problem.includes('receipt is invalid'),
		),
	);
	assert.ok(
		report.problems.some((problem) => problem.includes('five-minute')),
	);
});
