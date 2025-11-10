import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';
import { TranslateService } from '@ngx-translate/core';
import {
	Spied,
	createFirebaseAnalyticsMock,
} from '../../../../../../test-helpers';

import { LanguageToggleComponent } from './language-toggle.component';
import { of } from 'rxjs';

describe('LanguageToggleComponent', () => {
	let component: LanguageToggleComponent;
	let fixture: ComponentFixture<LanguageToggleComponent>;

	let translateService: Spied<TranslateService>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: TranslateService,
					useValue: jasmine.createSpyObj('TranslateService', {
						use: of({}),
						getCurrentLang: 'en',
					}),
				},
				{
					provide: Analytics,
					useFactory: createFirebaseAnalyticsMock,
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
		const newLang = 'es';
		(translateService.getCurrentLang as jasmine.Spy).and.returnValue('en');

		// checked: false should trigger toggle to 'es' when current is 'en'
		component.toggleLanguage({ detail: { checked: false } });

		expect(translateService.use).toHaveBeenCalledWith(newLang);
	});
});
