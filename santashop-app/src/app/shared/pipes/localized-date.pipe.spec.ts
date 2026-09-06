import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalizedDatePipe } from './localized-date.pipe';

@Component({
	template: `{{ date | localizedDate: format : timezone }}`,
	imports: [LocalizedDatePipe],
})
class LocalizedDateTestComponent {
	public date: Date | string | null = new Date('2026-12-20T12:00:00.000Z');
	public format = 'fullDate';
	public timezone: string | undefined = 'UTC';
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
	it('uses the Denver date across UTC midnight in both languages', () => {
		fixture.componentInstance.date = new Date('2026-07-13T00:30:00Z');
		fixture.componentInstance.timezone = 'America/Denver';
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent.trim()).toBe(
			'Sunday, July 12, 2026',
		);
		currentLanguage = 'es';
		languageChanges.next({ lang: 'es', translations: {} });
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent.trim()).toBe(
			'domingo, 12 de julio de 2026',
		);
	});
	it('resolves daylight saving time instead of using fixed MST', () => {
		fixture.componentInstance.date = new Date('2026-07-12T16:00:00Z');
		fixture.componentInstance.format = 'h:mm a';
		fixture.componentInstance.timezone = 'America/Denver';
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent.trim()).toBe('10:00 AM');
	});
	it('keeps a date-only birthday unchanged without an appointment zone', () => {
		fixture.componentInstance.date = '2015-01-01';
		fixture.componentInstance.format = 'yyyy-MM-dd';
		fixture.componentInstance.timezone = undefined;
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent.trim()).toBe('2015-01-01');
	});
});
