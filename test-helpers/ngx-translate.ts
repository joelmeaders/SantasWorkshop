import { Injectable, NgModule, Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

@Pipe({
	name: 'translate',
	standalone: true,
})
export class TranslatePipeMock implements PipeTransform {
	public transform(query: string, ..._args: any[]): any {
		return query;
	}
}

@Injectable()
export class TranslateServiceStub {
	private _currentLang = 'en';
	private _fallbackLang = 'en';
	private _langs: string[] = [];
	public translations: any = { en: {} };
	private readonly _onLangChange = new BehaviorSubject({
		lang: 'en',
		translations: {},
	});
	private readonly _onTranslationChange = new BehaviorSubject({
		lang: 'en',
		translations: {},
	});
	private readonly _onFallbackLangChange = new BehaviorSubject({
		lang: 'en',
		translations: {},
	});

	public onLangChange = this._onLangChange.asObservable();
	public onTranslationChange = this._onTranslationChange.asObservable();
	public onFallbackLangChange = this._onFallbackLangChange.asObservable();

	public get<T>(key: T): Observable<T> {
		return of(key);
	}

	public use(lang: string): Observable<any> {
		this._currentLang = lang;
		return of({ lang, translations: {} });
	}

	public addLangs(langs: string[]): void {
		this._langs = langs;
	}

	public setFallbackLang(lang: string): void {
		this._fallbackLang = lang;
	}

	public getBrowserLang(): string | undefined {
		return 'en';
	}

	public instant(key: string): string {
		return key;
	}

	public stream(key: string): Observable<string> {
		return of(key);
	}

	public getCurrentLang(): string {
		return this._currentLang;
	}

	public getFallbackLang(): string | null {
		return this._fallbackLang;
	}

	public getLangs(): string[] {
		return this._langs;
	}

	public getParsedResult(_translations: any, key: string): Observable<any> {
		// Return an observable for TranslatePipe compatibility
		return of(key);
	}
}

@NgModule({
	imports: [TranslatePipeMock],
	providers: [
		{ provide: TranslateService, useClass: TranslateServiceStub },
		{ provide: TranslatePipe, useClass: TranslatePipeMock },
	],
	exports: [TranslatePipeMock],
})
export class TranslateTestingModule {}
