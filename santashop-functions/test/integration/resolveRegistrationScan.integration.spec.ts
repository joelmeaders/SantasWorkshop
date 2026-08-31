import { beforeEach, describe, expect, it } from 'vitest';
import resolveRegistrationScan from '../../src/fn/resolveRegistrationScan';
import { COLLECTION_SCHEMA, type ResolveRegistrationScanRequest } from '@santashop/models';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { createRegistration } from '../fixtures/factories';
import {
	clearEmulatorData,
	getCollectionCount,
	getDocument,
	setDocument,
} from '../helpers/admin-emulator';
import { createCallableRequest } from '../helpers/callable-context';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';

describe.sequential('resolveRegistrationScan integration', () => {
	beforeEach(async () => {
		await clearEmulatorData();
	});

	it('returns eligible, incomplete, cancelled, and late-duplicate dispositions from Firestore state', async () => {
		const eligible = createRegistration({
			uid: 'scan-eligible',
			qrcode: 'ELIG1234',
			registrationSubmittedOn: new Date(),
		});
		const incomplete = createRegistration({ uid: 'scan-incomplete', qrcode: 'INCP1234' });
		const cancelled = createRegistration({
			uid: 'scan-cancelled',
			qrcode: 'NEWC1234',
			cancelledOn: new Date('2025-12-10T10:00:00.000Z'),
			cancellationLogId: 'cancelled-scan-log',
		});
		const duplicate = createRegistration({
			uid: 'scan-duplicate',
			qrcode: 'LATE1234',
			registrationSubmittedOn: new Date(),
		});
		await Promise.all([
			setDocument(COLLECTION_SCHEMA.registrations, eligible.uid!, eligible),
			setDocument(COLLECTION_SCHEMA.registrations, incomplete.uid!, incomplete),
			setDocument(COLLECTION_SCHEMA.registrations, cancelled.uid!, cancelled),
			setDocument(COLLECTION_SCHEMA.registrations, duplicate.uid!, duplicate),
			setDocument(COLLECTION_SCHEMA.cancellations, 'cancelled-scan-log', {
				uid: cancelled.uid,
				programYear: PROGRAM_YEAR,
				cancelledOn: cancelled.cancelledOn,
				supersededConfirmationCode: 'OLDC1234',
				supersededQrCodeStoragePath: 'registrations/scan-cancelled/old.png',
				replacementConfirmationCode: cancelled.qrcode,
				replacementQrCodeStoragePath: cancelled.qrCodeStoragePath,
			}),
			setDocument(COLLECTION_SCHEMA.checkins, duplicate.uid!, {
				customerId: duplicate.uid,
				registrationCode: duplicate.qrcode,
				checkInDateTime: new Date(Date.now() - 6 * 60 * 1000),
				inStats: false,
				stats: { children: 1 },
			}),
		]);
		const request = (code: string): CallableRequest<ResolveRegistrationScanRequest> => createCallableRequest(
			{ code, inputMethod: 'camera' },
			{ admin: true, uid: 'scan-staff' },
		);

		await expect(resolveRegistrationScan(request(eligible.qrcode!))).resolves.toMatchObject({ disposition: 'eligible' });
		await expect(resolveRegistrationScan(request(incomplete.qrcode!))).resolves.toMatchObject({ disposition: 'incomplete' });
		await expect(resolveRegistrationScan(request('OLDC1234'))).resolves.toMatchObject({ disposition: 'cancelled' });
		await expect(resolveRegistrationScan(request(duplicate.qrcode!))).resolves.toMatchObject({ disposition: 'duplicate-risk' });

		expect(await getCollectionCount(COLLECTION_SCHEMA.registrationScanAttempts)).toBe(2);
		expect(await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrationScanRiskSummaries,
			`${PROGRAM_YEAR}_${duplicate.uid}`,
		)).toMatchObject({ lateDuplicateAttemptCount: 1, totalRiskAttemptCount: 1 });
		const cancellationSummary = await getDocument<Record<string, unknown>>(
			COLLECTION_SCHEMA.registrationScanRiskSummaries,
			`${PROGRAM_YEAR}_${cancelled.uid}`,
		);
		expect(cancellationSummary).toMatchObject({ cancelledCodeAttemptCount: 1, totalRiskAttemptCount: 1 });
	});
});
