import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalizedDatePipe } from './localized-date.pipe';

@Component({
	template: `{{ date | localizedDate: 'fullDate' : 'UTC' }}`,
	imports: [LocalizedDatePipe],
})
class LocalizedDateTestComponent {
	public readonly date = new Date('2026-12-20T12:00:00.000Z');
}

describe('LocalizedDatePipe', () => {
	let fixture: ComponentFixture<LocalizedDateTestComponent>;
	let currentLanguage: 'en' | 'es';
	let languageChanges: Subject<{
		lang: string;
		translations: Record<string, unknown>;
	}>;

	beforeEach(async (): Promise<void> => {
		currentLanguage = 'en';
		languageChanges = new Subject();
		await TestBed.configureTestingModule({
			imports: [LocalizedDateTestComponent],
			providers: [
				{
					provide: TranslateService,
					useValue: {
						getCurrentLang: (): string => currentLanguage,
						onLangChange: languageChanges.asObservable(),
					},
				},
			],
		}).compileComponents();
		fixture = TestBed.createComponent(LocalizedDateTestComponent);
	});

	it('updates the displayed date when the language changes', async (): Promise<void> => {
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent.trim()).toBe(
			'Sunday, December 20, 2026',
		);

		currentLanguage = 'es';
		languageChanges.next({ lang: 'es', translations: {} });
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent.trim()).toBe(
			'domingo, 20 de diciembre de 2026',
		);
	});
});
