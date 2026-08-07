import {
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	type Mocked,
	vi,
} from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { AnalyticsWrapper } from '@santashop/core';

import { LanguageToggleComponent } from './language-toggle.component';
import { of } from 'rxjs';

describe('LanguageToggleComponent', () => {
	let component: LanguageToggleComponent;
	let fixture: ComponentFixture<LanguageToggleComponent>;

	let translateService: Mocked<TranslateService>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: TranslateService,
					useValue: {
						use: vi
							.fn()
							.mockName('TranslateService.use')
							.mockReturnValue(of({})),
						getCurrentLang: vi
							.fn()
							.mockName('TranslateService.getCurrentLang')
							.mockReturnValue('en'),
					},
				},
				{
					provide: AnalyticsWrapper,
					useValue: {
						logEvent: vi.fn().mockName('AnalyticsWrapper.logEvent'),
						logEventWithParams: vi
							.fn()
							.mockName('AnalyticsWrapper.logEventWithParams'),
						logErrorEvent: vi
							.fn()
							.mockName('AnalyticsWrapper.logErrorEvent'),
					},
				},
			],
			imports: [LanguageToggleComponent],
		}).compileComponents();

		translateService = TestBed.inject(
			TranslateService,
		) as Mocked<TranslateService>;

		fixture = TestBed.createComponent(LanguageToggleComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should toggle language', () => {
		const newLang = 'es';
	(translateService.getCurrentLang as MockInstance).mockReturnValue('en');

		// checked: false should trigger toggle to 'es' when current is 'en'
		component.toggleLanguage({ detail: { checked: false } });

		expect(translateService.use).toHaveBeenCalledWith(newLang);
	});
});
