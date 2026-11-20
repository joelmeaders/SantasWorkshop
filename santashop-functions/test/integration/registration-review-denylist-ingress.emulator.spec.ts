import { getAuth } from 'firebase-admin/auth';
import {
	deleteApp,
	initializeApp,
	type App,
	type AppOptions,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEmulatorData, getAdminApp } from '../helpers/admin-emulator';
import { createDefaultPublicParameters, ToyType } from '@santashop/models';
import { createRegistrationReviewDenylist } from '../../src/utility/registration-review-denylist';
import { assertRegistrationReviewAllowed } from '../../src/utility/registration-review-denylist-access';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';
import { createCallableRequest } from '../helpers/callable-context';
import { createOnboardUser } from '../fixtures/factories';

const project = 'demo-registration-review';
const shopper = { uid: 'blocked-test-shopper' };
const owner = { uid: 'fixture-owner', owner: true };
const caseId = 'c'.repeat(64);
const blockedEmail = 'blocked@example.invalid';
const unavailable = {
	code: 'permission-denied',
	message: 'This registration action is not available.',
};
let app: App;
let db: ReturnType<typeof getFirestore>;
let originalOptions: AppOptions | undefined;

describe(
	'registration-review denylist shopper ingress',
	() => {
		beforeAll(async () => {
			// Shopper handlers use the default app. Replace and restore it only
			// after the shared helper has verified every SDK endpoint is loopback.
			const previousApp = getAdminApp();
			const options = previousApp.options;
			await deleteApp(previousApp);
			originalOptions = options;
			app = initializeApp({
				projectId: project,
				storageBucket: `${project}.appspot.com`,
			});
			db = getFirestore(app);
		});

		beforeEach(async () => {
			vi.stubEnv('GCLOUD_PROJECT', project);
			await clearEmulatorData(app);
			const policy = createRegistrationReviewDenylist(db);
			await db.runTransaction((tx) =>
				policy.apply(tx, {
					kind: 'block',
					caseId,
					actorUid: owner.uid,
					shopperUid: shopper.uid,
					email: blockedEmail,
					reason: 'Synthetic block for fixture',
					cancellationId: 'fixture-cancellation',
					operationId: 'fixture-block-op',
				}),
			);
			await db.doc('_testConfig/publicParameters').set({
				...createDefaultPublicParameters(),
				createAccountEnabled: true,
				maintenanceModeEnabled: false,
				weatherModeEnabled: false,
			});
		});

		afterAll(async () => {
			try {
				if (app) {
					try {
						await clearEmulatorData(app);
					} finally {
						await deleteApp(app);
					}
				}
			} finally {
				if (originalOptions) initializeApp(originalOptions);
			}
		});

		it('denies fresh and staff signup by address before creating any Auth user', async () => {
			const [{ default: newAccount }, { default: preRegister }] =
				await Promise.all([
					import('../../src/fn/newAccount'),
					import('../../src/fn/callableAdminPreRegister'),
				]);
			await expect(
				newAccount(
					createCallableRequest(
						createOnboardUser({
							emailAddress: ' BLOCKED@example.invalid ',
						}),
					),
				),
			).rejects.toMatchObject(unavailable);
			await expect(
				preRegister(
					createCallableRequest(
						{
							qrCodeStoragePath: 'fixture-path',
							emailAddress: blockedEmail,
							firstName: 'Fixture',
							lastName: 'Shopper',
							zipCode: '80200',
							children: [
								{
									firstName: 'Fixture',
									id: 1,
									toyType: ToyType.boy,
									lastName: 'Child',
									dateOfBirth: new Date('2018-11-15'),
									enabled: true,
								},
							],
						},
						owner,
					),
				),
			).rejects.toMatchObject(unavailable);
			await expect(
				getAuth(app).getUserByEmail(blockedEmail),
			).rejects.toMatchObject({ code: 'auth/user-not-found' });
		});

		it('denies old-token and pending-resume paths, target email change, and rebooking a canceled record', async () => {
			const [
				{ default: newAccount },
				{ default: changeEmail },
				{ default: finish },
				{ default: changeAppointment },
				{ default: setAppointment },
				{ setWaitingListMembership },
				{ default: reviewAction },
			] = await Promise.all([
				import('../../src/fn/newAccount'),
				import('../../src/fn/updateEmailAddress'),
				import('../../src/fn/completeRegistration'),
				import('../../src/fn/changeRegistrationDateTime'),
				import('../../src/fn/setDraftAppointment'),
				import('../../src/fn/waitingList'),
				import('../../src/fn/performRegistrationReviewAction'),
			]);
			const allowed = { uid: 'fixture-other-shopper' };
			const allowedEmail = 'allowed@example.invalid';
			const registration = db.doc('registrations/' + shopper.uid);
			await Promise.all([
				getAuth(app).createUser({
					uid: shopper.uid,
					email: blockedEmail,
				}),
				getAuth(app).createUser({
					uid: allowed.uid,
					email: allowedEmail,
				}),
				db
					.doc('users/' + shopper.uid)
					.set({ emailAddress: blockedEmail }),
				db.doc('users/' + shopper.uid + '/provisioning/signup').set({
					user: { emailAddress: blockedEmail },
					registration: {
						qrcode: 'fixture-code',
						qrCodeStoragePath: 'fixture-path',
					},
					startedOn: new Date(),
					attemptCount: 0,
				}),
				registration.set({
					uid: shopper.uid,
					emailAddress: blockedEmail,
					programYear: PROGRAM_YEAR,
					qrcode: 'fixture-code',
					qrCodeStoragePath: 'fixture-path',
					cancelledOn: new Date(),
					cancellationLogId: 'fixture-cancellation',
				}),
				db
					.doc(
						`registrationReviewSeasons/${PROGRAM_YEAR}/cases/${caseId}`,
					)
					.set({
						season: PROGRAM_YEAR,
						registrations: [shopper.uid, allowed.uid],
						history: [],
					}),
			]);
			await expect(
				newAccount(createCallableRequest({ resume: true }, shopper)),
			).rejects.toMatchObject(unavailable);
			const receipt = { mutationId: 'review-fixture-attempt-0001' };
			await expect(
				finish(createCallableRequest(receipt, shopper)),
			).rejects.toMatchObject(unavailable);
			await expect(
				setAppointment(
					createCallableRequest(
						{ ...receipt, slotId: 'fixture-slot' },
						shopper,
					),
				),
			).rejects.toMatchObject(unavailable);
			await expect(
				changeAppointment(
					createCallableRequest(
						{ ...receipt, slotId: 'fixture-slot' },
						shopper,
					),
				),
			).rejects.toMatchObject(unavailable);
			await expect(
				setWaitingListMembership(
					createCallableRequest(
						{
							...receipt,
							active: true,
							source: 'maintenance',
						},
						shopper,
					),
				),
			).rejects.toMatchObject(unavailable);
			for (const [actor, from, to] of [
				[shopper, blockedEmail, 'other@example.invalid'],
				[allowed, allowedEmail, blockedEmail],
			] as const) {
				await expect(
					changeEmail(
						createCallableRequest(
							{
								...receipt,
								emailAddress: to,
								expectedEmailAddress: from,
							},
							actor,
						),
					),
				).rejects.toMatchObject(unavailable);
				expect((await getAuth(app).getUser(actor.uid)).email).toBe(
					from,
				);
			}
			const latest = await registration.get();
			if (!latest.updateTime)
				throw new Error('Expected registration revision.');
			await expect(
				reviewAction(
					createCallableRequest(
						{
							caseId,
							registrationId: shopper.uid,
							mutationId: 'fixture-reinstate-op',
							action: 'reinstate',
							reason: 'reviewed-and-cleared',
							expectedRevision: `${latest.updateTime.seconds}:${latest.updateTime.nanoseconds}`,
						},
						owner,
					),
					app,
				),
			).rejects.toMatchObject(unavailable);
			expect((await registration.get()).get('cancelledOn')).toBeDefined();
		});

		it('fails closed if the emulator targets an unknown project', async () => {
			vi.stubEnv('GCLOUD_PROJECT', 'demo-unrelated-project');
			try {
				await expect(
					assertRegistrationReviewAllowed(db, { email: blockedEmail }),
				).rejects.toMatchObject({ code: 'unavailable' });
			} finally {
				vi.stubEnv('GCLOUD_PROJECT', project);
			}
		});
	},
);
