import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';
import { Spied } from '../../../../../../test-helpers';

import { LanguageToggleComponent } from './language-toggle.component';

describe('LanguageToggleComponent', () => {
	let component: LanguageToggleComponent;
	let fixture: ComponentFixture<LanguageToggleComponent>;

	let translateService: Spied<TranslateService>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: TranslateService,
					useValue: translateService,
				},
			],
			imports: [LanguageToggleComponent],
		}).compileComponents();

		translateService = TestBed.inject(
			TranslateService,
		) as jasmine.SpyObj<TranslateService>;

		fixture = TestBed.createComponent(LanguageToggleComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should toggle language', () => {
		const currentLang = 'en';
		const newLang = 'es';
		translateService.currentLang = currentLang;

		component.toggleLanguage({ detail: { checked: true } });

		expect(translateService.use).toHaveBeenCalledWith(newLang);
	});
});
