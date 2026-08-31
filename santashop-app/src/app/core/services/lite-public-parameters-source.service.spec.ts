import { TestBed } from '@angular/core/testing';
import type { PublicParameters } from '@santashop/models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	FIREBASE_FIRESTORE_LITE,
	FIREBASE_FIRESTORE_LITE_DOCUMENT_READER,
} from '../tokens/customer-runtime.token';
import { LitePublicParametersSource } from './lite-public-parameters-source.service';

const getDocument = vi.fn();

const parameters = (
	overrides: Partial<PublicParameters> = {},
): PublicParameters =>
	({
		admin: {
			allowCancelRegistration: true,
			allowChangeRegistration: true,
			checkinEnabled: true,
			onsiteRegistrationEnabled: true,
			preRegistrationEnabled: true,
		},
		createAccountEnabled: true,
		globalAlert: { displayAlert: false },
		maintenanceModeEnabled: false,
		messageEn: '',
		messageEs: '',
		registrationEnabled: true,
		weatherModeEnabled: false,
		...overrides,
	}) as PublicParameters;

const snapshot = (value?: PublicParameters): object => ({
	exists: (): boolean => value !== undefined,
	data: (): PublicParameters | undefined => value,
});

describe('LitePublicParametersSource', () => {
	let visibilityState: DocumentVisibilityState;

	beforeEach(() => {
		vi.useFakeTimers();
		visibilityState = 'visible';
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => visibilityState,
		);
		getDocument.mockReset();

		TestBed.configureTestingModule({
			providers: [
				LitePublicParametersSource,
				{ provide: FIREBASE_FIRESTORE_LITE, useValue: 'firestore-lite' },
				{
					provide: FIREBASE_FIRESTORE_LITE_DOCUMENT_READER,
					useValue: { getDocument },
				},
			],
		});
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('reads the public document immediately and every 60 seconds while visible', async (): Promise<void> => {
		const first = parameters();
		const second = parameters({ createAccountEnabled: false });
		getDocument
			.mockResolvedValueOnce(snapshot(first))
			.mockResolvedValueOnce(snapshot(second));
		const values: PublicParameters[] = [];
		const subscription = TestBed.inject(
			LitePublicParametersSource,
		).publicParameters$.subscribe((value) => {
			if (value) values.push(value);
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(values).toEqual([first]);
		expect(getDocument).toHaveBeenCalledWith(
			'firestore-lite',
			'parameters',
			'public',
		);

		await vi.advanceTimersByTimeAsync(60_000);
		expect(values).toEqual([first, second]);
		subscription.unsubscribe();
	});

	it('suppresses hidden polling and refreshes on visibility, focus, or reconnection', async (): Promise<void> => {
		getDocument.mockResolvedValue(snapshot(parameters()));
		const subscription = TestBed.inject(
			LitePublicParametersSource,
		).publicParameters$.subscribe();
		await vi.advanceTimersByTimeAsync(0);

		visibilityState = 'hidden';
		await vi.advanceTimersByTimeAsync(60_000);
		expect(getDocument).toHaveBeenCalledTimes(1);

		visibilityState = 'visible';
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(getDocument).toHaveBeenCalledTimes(2);

		globalThis.dispatchEvent(new Event('focus'));
		await vi.advanceTimersByTimeAsync(0);
		expect(getDocument).toHaveBeenCalledTimes(3);

		globalThis.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(getDocument).toHaveBeenCalledTimes(4);
		subscription.unsubscribe();
	});

	it('retains the last distinct value when a read is missing or duplicated', async (): Promise<void> => {
		const value = parameters();
		getDocument
			.mockResolvedValueOnce(snapshot(value))
			.mockResolvedValueOnce(snapshot({ ...value }))
			.mockResolvedValueOnce(snapshot());
		const values: PublicParameters[] = [];
		const subscription = TestBed.inject(
			LitePublicParametersSource,
		).publicParameters$.subscribe((result) => {
			if (result) values.push(result);
		});

		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(60_000);
		await vi.advanceTimersByTimeAsync(60_000);

		expect(values).toEqual([value]);
		subscription.unsubscribe();
	});

	it('recovers from a failed read on the next lifecycle trigger', async (): Promise<void> => {
		const value = parameters();
		getDocument
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(snapshot(value));
		const values: PublicParameters[] = [];
		const subscription = TestBed.inject(
			LitePublicParametersSource,
		).publicParameters$.subscribe((result) => {
			if (result) values.push(result);
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(values).toEqual([]);

		await vi.advanceTimersByTimeAsync(250);
		globalThis.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(values).toEqual([value]);
		subscription.unsubscribe();
	});
});
