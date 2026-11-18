import { getAuth } from 'firebase-admin/auth';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDefaultPublicParameters, ToyType } from '@santashop/models';
import { createRegistrationReviewDenylist } from '../../src/utility/registration-review-denylist';
import { assertRegistrationReviewAllowed } from '../../src/utility/registration-review-denylist-access';
import { PROGRAM_YEAR } from '../../src/utility/runtime-config';
import { createCallableRequest } from '../helpers/callable-context';
import { createOnboardUser } from '../fixtures/factories';

const project = 'demo-registration-review';
const secret = Buffer.alloc(32, 118);
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

describe.skipIf(process.env['REGISTRATION_REVIEW_INGRESS_TEST'] !== 'true')(
	'registration-review denylist shopper ingress',
	() => {
		beforeAll(async () => {
			if (
				process.env['FIRESTORE_EMULATOR_HOST'] !== '127.0.0.1:18181' ||
				process.env['FIREBASE_AUTH_EMULATOR_HOST'] !== '127.0.0.1:18191'
			) {
				throw new Error(
					'Expected dedicated loopback Firestore and Auth emulators.',
				);
			}
			vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
			vi.stubEnv('GCLOUD_PROJECT', project);
			vi.stubEnv(
				'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED',
				'true',
			);
			vi.stubEnv(
				'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY',
				secret.toString('base64'),
			);
			vi.stubEnv('SANTASHOP_REGISTRATION_REVIEW_ENABLED', 'true');
			app = initializeApp({ projectId: project });
			db = getFirestore(app);
			const policy = createRegistrationReviewDenylist(db, secret);
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
			if (app) await deleteApp(app);
			vi.unstubAllEnvs();
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

		it('defaults off without accessing policy and fails closed for unresolved key when enabled', async () => {
			const key =
				process.env['SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY'];
			vi.stubEnv(
				'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY',
				undefined,
			);
			try {
				await expect(
					assertRegistrationReviewAllowed(db, {
						email: blockedEmail,
					}),
				).rejects.toMatchObject({ code: 'unavailable' });
				vi.stubEnv(
					'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED',
					undefined,
				);
				await expect(
					assertRegistrationReviewAllowed(db, {
						email: blockedEmail,
					}),
				).resolves.toBeUndefined();
			} finally {
				vi.stubEnv(
					'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_ENABLED',
					'true',
				);
				vi.stubEnv(
					'SANTASHOP_REGISTRATION_REVIEW_DENYLIST_HMAC_KEY',
					key,
				);
			}
		});
	},
);
