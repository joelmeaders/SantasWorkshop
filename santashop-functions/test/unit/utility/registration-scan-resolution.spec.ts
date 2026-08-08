import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundAdminMock } from '../../helpers/firebase-admin-background.mock';

describe('registration scan resolution', () => {
	let adminMock: ReturnType<typeof createBackgroundAdminMock>;

	beforeEach(() => {
		adminMock = createBackgroundAdminMock();
	});

	const loadResolver = async () => {
		vi.resetModules();
		vi.doMock('firebase-admin', () => adminMock.module);
		return import('../../../src/utility/registration-scan');
	};

	const submittedRegistration = (uid = 'customer-1') => ({
		uid,
		qrcode: 'ABCD1234',
		registrationSubmittedOn: new Date('2025-12-01T00:00:00.000Z'),
		firstName: 'Buddy',
		lastName: 'Elf',
		emailAddress: 'buddy@example.com',
	});

	it('returns an eligible submitted registration with no prior check-in', async () => {
		const { resolveRegistrationCode } = await loadResolver();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: submittedRegistration() },
		]);

		await expect(
			resolveRegistrationCode('ABCD1234', 'camera', 'staff-1'),
		).resolves.toMatchObject({
			disposition: 'eligible',
			registration: { uid: 'customer-1' },
		});
	});

	it('returns incomplete before recording a scan for an unfinished registration', async () => {
		const { resolveRegistrationCode } = await loadResolver();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: { uid: 'customer-1', qrcode: 'ABCD1234' } },
		]);

		await expect(
			resolveRegistrationCode('ABCD1234', 'manual', 'staff-1'),
		).resolves.toEqual({ disposition: 'incomplete', customerId: 'customer-1' });
		expect(
			adminMock.getCollectionRef('registrationScanAttempts').doc,
		).not.toHaveBeenCalled();
	});

	it('records a short-interval duplicate as an accidental rescan', async () => {
		const { resolveRegistrationCode } = await loadResolver();
		const checkedInOn = new Date('2025-12-10T18:00:00.000Z');
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: submittedRegistration() },
		]);
		adminMock.setDocSnapshot('checkins/customer-1', {
			checkInDateTime: { toDate: () => checkedInOn },
		});

		const result = await resolveRegistrationCode(
			'ABCD1234',
			'camera',
			'staff-1',
			new Date('2025-12-10T18:04:00.000Z'),
		);

		expect(result).toMatchObject({
			disposition: 'duplicate-accidental',
			attempt: {
				outcome: 'duplicate-accidental',
				elapsedSeconds: 240,
				codeSuffix: '1234',
			},
		});
		expect(
			adminMock.getCollectionRef('registrationScanAttempts').doc,
		).toHaveBeenCalledTimes(1);
	});

	it('records a late duplicate in a risk summary transaction', async () => {
		const { resolveRegistrationCode } = await loadResolver();
		const checkedInOn = new Date('2025-12-10T18:00:00.000Z');
		adminMock.setCollectionDocs('registrations', [
			{ id: 'customer-1', data: submittedRegistration() },
		]);
		adminMock.setDocSnapshot('checkins/customer-1', {
			checkInDateTime: { toDate: () => checkedInOn },
		});
		adminMock.setDocSnapshot('registrationScanRiskSummaries/2025_customer-1', {
			accidentalAttemptCount: 2,
			lateDuplicateAttemptCount: 3,
			cancelledCodeAttemptCount: 1,
			totalRiskAttemptCount: 4,
			firstRiskOn: { toDate: () => checkedInOn },
		});

		await expect(
			resolveRegistrationCode(
				'ABCD1234',
				'manual',
				'staff-1',
				new Date('2025-12-10T18:06:00.000Z'),
			),
		).resolves.toMatchObject({ disposition: 'duplicate-risk' });
		expect(adminMock.runTransaction).toHaveBeenCalledTimes(1);
		expect(adminMock.transactionSet).toHaveBeenCalledWith(
			adminMock.getDocRef('registrationScanRiskSummaries/2025_customer-1'),
			expect.objectContaining({
				lateDuplicateAttemptCount: 4,
				totalRiskAttemptCount: 5,
				latestOutcome: 'duplicate-risk',
			}),
		);
	});

	it('finds a cancelled superseded code and records it as a risk attempt', async () => {
		const { resolveRegistrationCode } = await loadResolver();
		adminMock.setCollectionDocs('registrations', []);
		adminMock.setCollectionDocs('cancellations', [
			{
				id: 'cancel-1',
				data: {
					uid: 'customer-1',
					programYear: 2025,
					supersededConfirmationCode: 'ABCD1234',
					cancelledOn: { toDate: () => new Date('2025-12-09T18:00:00.000Z') },
				},
			},
		]);
		adminMock.setDocSnapshot('registrations/customer-1', submittedRegistration());
		adminMock.setDocSnapshot('checkins/customer-1', {
			checkInDateTime: { toDate: () => new Date('2025-12-08T18:00:00.000Z') },
		});

		await expect(
			resolveRegistrationCode('ABCD1234', 'camera', 'staff-1'),
		).resolves.toMatchObject({
			disposition: 'cancelled',
			cancellation: { id: 'cancel-1' },
			priorCheckIn: { checkInDateTime: expect.any(Object) },
			attempt: { outcome: 'cancelled' },
		});
	});

	it('rejects ambiguous registration and cancellation code matches', async () => {
		const { resolveRegistrationCode } = await loadResolver();
		adminMock.setCollectionDocs('registrations', [
			{ id: 'one', data: submittedRegistration('one') },
			{ id: 'two', data: submittedRegistration('two') },
		]);
		await expect(
			resolveRegistrationCode('ABCD1234', 'camera', 'staff-1'),
		).rejects.toMatchObject({ code: 'failed-precondition' });

		adminMock.setCollectionDocs('registrations', []);
		adminMock.setCollectionDocs('cancellations', [
			{ id: 'one', data: {} },
			{ id: 'two', data: {} },
		]);
		await expect(
			resolveRegistrationCode('ABCD1234', 'camera', 'staff-1'),
		).rejects.toMatchObject({ code: 'failed-precondition' });
	});
});
