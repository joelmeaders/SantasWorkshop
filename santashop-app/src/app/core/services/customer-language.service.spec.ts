import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, FunctionsWrapper } from '@santashop/core/customer';
import {
	FIREBASE_FIRESTORE_LITE,
	FIREBASE_FIRESTORE_LITE_DOCUMENT_READER,
} from '../tokens/customer-runtime.token';
import { BehaviorSubject, firstValueFrom, Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerLanguageService } from './customer-language.service';

describe('CustomerLanguageService', () => {
	let service: CustomerLanguageService;
	let auth: BehaviorSubject<{ uid: string } | null>;
	const read = vi.fn();
	const save = vi.fn();
	const use = vi.fn();
	const createAlert = vi.fn();
	let currentLanguage = 'en';

	beforeEach(() => {
		auth = new BehaviorSubject<{ uid: string } | null>(null);
		currentLanguage = 'en';
		window.localStorage.removeItem('santashop-language');
		read.mockReset().mockResolvedValue({
			data: (): object => ({ preferredLanguage: 'es' }),
		});
		save.mockReset().mockResolvedValue({});
		use.mockReset().mockImplementation((language: string) => {
			currentLanguage = language;
			return of({});
		});
		createAlert
			.mockReset()
			.mockResolvedValue({
				present: vi.fn().mockResolvedValue(undefined),
			});
		TestBed.configureTestingModule({
			providers: [
				{ provide: AuthService, useValue: { currentUser$: auth } },
				{
					provide: FunctionsWrapper,
					useValue: {
						callableWrapper: vi.fn().mockReturnValue(save),
					},
				},
				{ provide: FIREBASE_FIRESTORE_LITE, useValue: {} },
				{
					provide: FIREBASE_FIRESTORE_LITE_DOCUMENT_READER,
					useValue: { getDocument: read },
				},
				{
					provide: TranslateService,
					useValue: {
						use,
						getCurrentLang: (): string => currentLanguage,
						instant: (key: string): string => key,
					},
				},
				{ provide: AlertController, useValue: { create: createAlert } },
			],
		});
		service = TestBed.inject(CustomerLanguageService);
		service.initialize();
	});

	it('keeps anonymous choices local and restores the saved preference at login', async () => {
		await service.setLanguage('en');
		expect(save).not.toHaveBeenCalled();
		auth.next({ uid: 'family' });
		await vi.waitFor(() =>
			expect(window.localStorage.getItem('santashop-language')).toBe(
				'es',
			),
		);
		expect(save).not.toHaveBeenCalled();
		await service.setLanguage('en');
		expect(save).toHaveBeenCalledWith({ preferredLanguage: 'en' });
	});

	it('initializes a missing profile preference from the active app language', async () => {
		read.mockResolvedValue({ data: (): object => ({}) });
		await service.setLanguage('es');
		auth.next({ uid: 'family' });
		await vi.waitFor(() =>
			expect(save).toHaveBeenCalledWith({ preferredLanguage: 'es' }),
		);
	});

	it('shows a translated save error and supports retry while leaving the app usable', async () => {
		auth.next({ uid: 'family' });
		await vi.waitFor(() => expect(currentLanguage).toBe('es'));
		save.mockRejectedValueOnce(new Error('Offline'));
		await service.setLanguage('en');
		expect(currentLanguage).toBe('en');
		expect(createAlert).toHaveBeenCalledWith(
			expect.objectContaining({ message: 'LANGUAGE.SAVE_ERROR' }),
		);
		createAlert.mock.calls[0][0].buttons[1].handler();
		await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
	});

	it('does not let an old profile read overwrite a newer account or explicit choice', async () => {
		const oldProfile = new Subject<{ preferredLanguage: string }>();
		read.mockReturnValueOnce(
			firstValueFrom(oldProfile).then((profile) => ({
				data: (): object => profile,
			})),
		);
		auth.next({ uid: 'old-family' });
		auth.next(null);
		await service.setLanguage('en');
		oldProfile.next({ preferredLanguage: 'es' });
		oldProfile.complete();
		await Promise.resolve();
		expect(currentLanguage).toBe('en');
		expect(save).not.toHaveBeenCalled();
	});
});
