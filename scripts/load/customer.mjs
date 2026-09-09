import { randomUUID } from 'node:crypto';
import {
	PROJECT,
	REGION,
	assertClientConfig,
	childFixture,
} from './config.mjs';
import { decodeFields, firestoreBase } from './google.mjs';

export class CustomerApi {
	constructor(config, appCheckToken, journal) {
		assertClientConfig(config);
		this.config = config;
		this.appCheckToken = appCheckToken;
		this.journal = journal;
	}
	async json(url, options = {}) {
		const response = await fetch(url, {
			redirect: 'error',
			signal: AbortSignal.timeout(35_000),
			...options,
		});
		const result = await response.json();
		if (!response.ok || result.error) {
			const error = new Error('Client request failed.');
			error.code =
				result.error?.status ??
				result.error?.message ??
				`HTTP_${response.status}`;
			throw error;
		}
		return result;
	}
	headers(session) {
		return {
			'Content-Type': 'application/json',
			'X-Firebase-AppCheck': this.appCheckToken(),
			...(session ? { Authorization: `Bearer ${session.idToken}` } : {}),
		};
	}
	async call(phase, name, data, session, options = {}) {
		this.journal.assertRunning();
		if (!/^[A-Za-z]+$/.test(name)) throw new Error('Invalid callable.');
		return this.journal.measure(
			phase,
			name,
			async () => {
				const result = await this.json(
					`https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`,
					{
						method: 'POST',
						headers: this.headers(session),
						body: JSON.stringify({ data }),
						...(options.signal ? { signal: options.signal } : {}),
					},
				);
				return result.result ?? result.data;
			},
			options.expectedCodes,
		);
	}
	async signIn(phase, fixture) {
		const result = await this.journal.measure(
			phase,
			'signInWithPassword',
			() =>
				this.json(
					`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(this.config.apiKey)}`,
					{
						method: 'POST',
						headers: this.headers(),
						body: JSON.stringify({
							email: fixture.emailAddress,
							password: fixture.password,
							returnSecureToken: true,
						}),
					},
				),
		);
		if (fixture.uid && result.localId !== fixture.uid)
			throw new Error('Authenticated UID mismatch.');
		return { uid: result.localId, idToken: result.idToken };
	}
	async readRegistration(phase, session) {
		return this.journal.measure(phase, 'readRegistration', async () => {
			const doc = await this.json(
				`${firestoreBase}/registrations/${session.uid}`,
				{ headers: this.headers(session) },
			);
			return { uid: session.uid, ...decodeFields(doc.fields) };
		});
	}
	async readQr(phase, session, registration) {
		const path = registration.qrCodeStoragePath;
		if (
			!path?.startsWith(`registrations/${session.uid}/`) ||
			!/^[a-z0-9]{8}$/i.test(registration.qrcode ?? '')
		)
			throw new Error('QR ownership or code is invalid.');
		await this.journal.measure(phase, 'retrieveQr', async () => {
			const response = await fetch(
				`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(this.config.storageBucket)}/o/${encodeURIComponent(path)}?alt=media`,
				{
					headers: {
						...this.headers(session),
						Authorization: `Firebase ${session.idToken}`,
					},
					redirect: 'error',
					signal: AbortSignal.timeout(30_000),
				},
			);
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (
				!response.ok ||
				bytes.length < 8 ||
				bytes.slice(0, 8).join(',') !== '137,80,78,71,13,10,26,10'
			)
				throw new Error('QR PNG retrieval failed.');
		});
	}
	async prepare(phase, fixture, slotId, year) {
		this.journal.assertRunning();
		this.journal.record({
			type: 'account-intent',
			fixture: fixture.id,
			emailAddress: fixture.emailAddress,
			phase,
		});
		fixture.uid = await this.call(phase, 'newAccount', {
			firstName: fixture.firstName,
			lastName: fixture.lastName,
			emailAddress: fixture.emailAddress,
			password: fixture.password,
			password2: fixture.password,
			zipCode: '80202',
			referredBy: 'Other - Load acceptance QA',
			newsletter: false,
			legal: true,
			preferredLanguage: 'en',
		});
		this.journal.record({
			type: 'account-created',
			fixture: fixture.id,
			uid: fixture.uid,
			phase,
		});
		const session = await this.signIn(phase, fixture);
		for (let index = 0; index < 3; index++) {
			await this.call(
				phase,
				'saveDraftChild',
				{ mutationId: randomUUID(), child: childFixture(year, index) },
				session,
			);
		}
		await this.call(
			phase,
			'setDraftAppointment',
			{ mutationId: randomUUID(), slotId },
			session,
		);
		return session;
	}
	async complete(phase, fixture, session, mutationId = randomUUID()) {
		this.journal.record({
			type: 'completion-intent',
			fixture: fixture.id,
			uid: fixture.uid,
			mutationId,
			phase,
		});
		await this.call(phase, 'completeRegistration', { mutationId }, session);
		const registration = await this.readRegistration(phase, session);
		if (
			!registration.registrationSubmittedOn ||
			registration.children?.length !== 3
		)
			throw new Error('Completed registration is incomplete.');
		await this.readQr(phase, session, registration);
		this.journal.record({
			type: 'registration-completed',
			fixture: fixture.id,
			uid: fixture.uid,
			phase,
		});
		return registration;
	}
}
