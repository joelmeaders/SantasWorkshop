import { Injectable, OnDestroy, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, FunctionsWrapper } from '@santashop/core/customer';
import {
	FIREBASE_FIRESTORE_LITE,
	FIREBASE_FIRESTORE_LITE_DOCUMENT_READER,
} from '../tokens/customer-runtime.token';
import {
	COLLECTION_SCHEMA,
	customerLanguageOrEnglish,
	isCustomerLanguage,
	type CustomerLanguage,
	type User,
} from '@santashop/models';
import {
	BehaviorSubject,
	Subject,
	distinctUntilChanged,
	firstValueFrom,
	map,
	takeUntil,
} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomerLanguageService implements OnDestroy {
	private readonly auth = inject(AuthService);
	private readonly functions = inject(FunctionsWrapper);
	private readonly firestore = inject(FIREBASE_FIRESTORE_LITE);
	private readonly profiles = inject(FIREBASE_FIRESTORE_LITE_DOCUMENT_READER);
	private readonly translate = inject(TranslateService);
	private readonly alerts = inject(AlertController);
	private readonly destroyed$ = new Subject<void>();
	private readonly languageSubject = new BehaviorSubject<CustomerLanguage>(
		'en',
	);
	public readonly language$ = this.languageSubject.asObservable();
	private uid?: string;
	private started = false;
	private sequence = 0;
	private saves: Promise<void> = Promise.resolve();

	public initialize(): void {
		if (this.started) return;
		this.started = true;
		this.languageSubject.next(
			customerLanguageOrEnglish(this.translate.getCurrentLang()),
		);
		this.auth.currentUser$
			.pipe(
				map((user) => user?.uid),
				distinctUntilChanged(),
				takeUntil(this.destroyed$),
			)
			.subscribe((uid) => {
				this.uid = uid;
				const sequence = ++this.sequence;
				if (uid) void this.restore(uid, sequence);
			});
	}

	public async setLanguage(language: CustomerLanguage): Promise<void> {
		const sequence = ++this.sequence;
		const uid = this.uid;
		await this.apply(language, sequence);
		if (uid && uid === this.uid && sequence === this.sequence)
			await this.save(uid, language);
	}

	private async apply(
		language: CustomerLanguage,
		sequence = this.sequence,
	): Promise<void> {
		await firstValueFrom(this.translate.use(language));
		if (sequence !== this.sequence) return;
		window.localStorage.setItem('santashop-language', language);
		this.languageSubject.next(language);
	}

	private async restore(uid: string, sequence: number): Promise<void> {
		try {
			const snapshot = await this.profiles.getDocument(
				this.firestore,
				COLLECTION_SCHEMA.users,
				uid,
			);
			const profile = snapshot.data() as User | undefined;
			if (uid !== this.uid || sequence !== this.sequence) return;
			if (isCustomerLanguage(profile?.preferredLanguage))
				await this.apply(profile.preferredLanguage, sequence);
			else
				await this.save(
					uid,
					customerLanguageOrEnglish(this.translate.getCurrentLang()),
				);
		} catch {
			if (uid === this.uid)
				await this.showSaveError(
					uid,
					customerLanguageOrEnglish(this.translate.getCurrentLang()),
				);
		}
	}

	private async save(uid: string, language: CustomerLanguage): Promise<void> {
		this.saves = this.saves.then(async () => {
			if (uid !== this.uid) return;
			try {
				await this.functions.callableWrapper<
					{ preferredLanguage: CustomerLanguage },
					void
				>('updatePreferredLanguage')({ preferredLanguage: language });
			} catch {
				if (uid === this.uid) await this.showSaveError(uid, language);
			}
		});
		await this.saves;
	}

	private async showSaveError(
		uid: string,
		language: CustomerLanguage,
	): Promise<void> {
		const alert = await this.alerts.create({
			header: this.translate.instant('LANGUAGE.SAVE_ERROR_TITLE'),
			message: this.translate.instant('LANGUAGE.SAVE_ERROR'),
			buttons: [
				{
					text: this.translate.instant('LANGUAGE.DISMISS'),
					role: 'cancel',
				},
				{
					text: this.translate.instant('LANGUAGE.RETRY'),
					handler: (): void => {
						if (uid === this.uid) void this.save(uid, language);
					},
				},
			],
		});
		await alert.present();
	}

	public ngOnDestroy(): void {
		this.destroyed$.next();
		this.destroyed$.complete();
	}
}
