import { TestBed } from '@angular/core/testing';
import { AppStateService } from '@santashop/core/customer';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationalNoticeComponent } from './operational-notice.component';

describe('OperationalNoticeComponent', () => {
	const messageDoc$ = new BehaviorSubject({
		messageEn: 'Registration is paused.',
		messageEs: 'El registro está en pausa.',
	});
	let currentLanguage = 'en';

	beforeEach(() => {
		currentLanguage = 'en';
		messageDoc$.next({
			messageEn: 'Registration is paused.',
			messageEs: 'El registro está en pausa.',
		});
		TestBed.configureTestingModule({
			imports: [OperationalNoticeComponent],
			providers: [
				{ provide: AppStateService, useValue: { messageDoc$ } },
				{
					provide: TranslateService,
					useValue: {
						getCurrentLang: vi.fn(() => currentLanguage),
					},
				},
			],
		});
	});

	it('selects the image for each operating mode', () => {
		const fixture = TestBed.createComponent(OperationalNoticeComponent);
		const component = fixture.componentInstance;

		component.mode = 'maintenance';
		expect(component.image).toBe('assets/images/maintenance.png');
		component.mode = 'weather';
		expect(component.image).toBe('assets/images/bad-weather.png');
		component.mode = 'registration-closed';
		expect(component.image).toBe('assets/images/registration-closed.png');
	});

	it('uses the active language for the live operational message', async () => {
		const component = TestBed.createComponent(
			OperationalNoticeComponent,
		).componentInstance;

		await expect(firstValueFrom(component.message$)).resolves.toBe(
			'Registration is paused.',
		);
		currentLanguage = 'es';
		messageDoc$.next({
			messageEn: 'Registration is paused.',
			messageEs: 'El registro está en pausa.',
		});
		await expect(firstValueFrom(component.message$)).resolves.toBe(
			'El registro está en pausa.',
		);
	});

	it('suppresses an empty message', async () => {
		messageDoc$.next({ messageEn: '', messageEs: '' });
		const component = TestBed.createComponent(
			OperationalNoticeComponent,
		).componentInstance;

		await expect(firstValueFrom(component.message$)).resolves.toBeNull();
	});
});
