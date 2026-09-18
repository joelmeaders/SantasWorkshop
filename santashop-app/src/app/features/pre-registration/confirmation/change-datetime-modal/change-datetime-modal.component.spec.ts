import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import type { DateTimeSlot } from '@santashop/models';
import { BehaviorSubject, Subject } from 'rxjs';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import en from '../../../../../assets/i18n/en.json';
import es from '../../../../../assets/i18n/es.json';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createModalControllerMock } from '../../../../../test-helpers';
import { ChangeDatetimeModalComponent } from './change-datetime-modal.component';

describe('ChangeDatetimeModalComponent', () => {
	let component: ChangeDatetimeModalComponent;
	let fixture: ComponentFixture<ChangeDatetimeModalComponent>;
	let modalController: { dismiss: ReturnType<typeof vi.fn> };
	const slots = new BehaviorSubject<DateTimeSlot[]>([]);

	const slot = (id: string, dateTime: Date, enabled = true): DateTimeSlot =>
		({
			id,
			dateTime,
			enabled,
			maxSlots: 3,
			slotsReserved: 1,
		}) as DateTimeSlot;

	beforeEach(async (): Promise<void> => {
		slots.next([]);
		modalController = createModalControllerMock() as unknown as {
			dismiss: ReturnType<typeof vi.fn>;
		};
		await TestBed.configureTestingModule({
			imports: [ChangeDatetimeModalComponent],
			providers: [
				provideTranslateService(),
				{ provide: ModalController, useValue: modalController },
			],
		}).compileComponents();
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', en);
		translate.setTranslation('es', es);
		translate.use('en');
		fixture = TestBed.createComponent(ChangeDatetimeModalComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'currentSlot',
			slot('current', new Date('2026-12-20T10:00:00')),
		);
		fixture.componentRef.setInput('availableSlots', slots.asObservable());
		await fixture.whenStable();
	});

	it.each(['en', 'es'])(
		'explains full capacity in %s when only the current appointment remains',
		async (language): Promise<void> => {
			TestBed.inject(TranslateService).use(language);
			slots.next([
				component.currentSlotValue()!,
				{
					...slot('full', new Date('2026-12-21T11:00:00')),
					slotsReserved: 3,
				},
				slot('disabled', new Date('2026-12-22T11:00:00'), false),
			]);
			await fixture.whenStable();
			const copy = (language === 'es' ? es : en).CONFIRMATION;
			expect(fixture.nativeElement.textContent).toContain(
				copy.NO_OTHER_APPOINTMENTS_MSG,
			);
			expect(
				fixture.nativeElement.querySelector('ion-accordion-group'),
			).toBeNull();
			const facebook =
				fixture.nativeElement.querySelector('ion-button[href]');
			expect(facebook.getAttribute('href')).toBe(
				'https://www.facebook.com/denversantaclausshop',
			);
			expect(facebook.getAttribute('target')).toBe('_blank');
			expect(facebook.getAttribute('rel')).toBe('noopener noreferrer');
			expect(modalController.dismiss).not.toHaveBeenCalled();
		},
	);

	it('updates the combined message and picker when availability changes', async (): Promise<void> => {
		expect(fixture.nativeElement.textContent).toContain(
			en.CONFIRMATION.NO_OTHER_APPOINTMENTS_MSG,
		);
		slots.next([slot('available', new Date('2026-12-20T11:00:00'))]);
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			en.CONFIRMATION.CONFIRM_DATETIME_CHANGE_MSG,
		);
		expect(
			fixture.nativeElement.querySelector('ion-accordion-group'),
		).toBeTruthy();
		expect(
			fixture.nativeElement.querySelector('ion-button[href]'),
		).toBeNull();
		slots.next([]);
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			en.CONFIRMATION.NO_OTHER_APPOINTMENTS_MSG,
		);
	});

	it('does not report full capacity while loading or after a load failure', async (): Promise<void> => {
		const pending = new Subject<DateTimeSlot[]>();
		fixture.componentRef.setInput('availableSlots', pending);
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			en.CONFIRMATION.LOADING_APPOINTMENTS,
		);
		expect(fixture.nativeElement.textContent).not.toContain(
			en.CONFIRMATION.NO_OTHER_APPOINTMENTS_MSG,
		);
		pending.error(new Error('Unavailable'));
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain(
			en.CONFIRMATION.APPOINTMENTS_LOAD_ERROR,
		);
		expect(fixture.nativeElement.textContent).not.toContain(
			en.CONFIRMATION.NO_OTHER_APPOINTMENTS_MSG,
		);
	});

	it('renders live selectable slots and excludes disabled ones', async (): Promise<void> => {
		slots.next([
			slot('current', new Date('2026-12-20T10:00:00')),
			slot('available', new Date('2026-12-20T11:00:00')),
			slot('disabled', new Date('2026-12-21T11:00:00'), false),
		]);

		await fixture.whenStable();

		expect(
			fixture.nativeElement.querySelector(
				'[data-change-slot-id="available"]',
			),
		).toBeTruthy();
		expect(component.availableDays()).toHaveLength(1);
	});

	it('groups slots by the Denver event date independently of the host timezone', async (): Promise<void> => {
		slots.next([
			slot('afternoon', new Date('2026-12-07T16:00:00.000Z')),
			slot('evening', new Date('2026-12-08T01:00:00.000Z')),
		]);

		const eventDay = Date.UTC(2026, 11, 7, 12);
		expect(component.availableDays()).toEqual([eventDay]);
		expect(component.availableSlotsByDay(eventDay)).toHaveLength(2);
	});

	it('switches to replacement slot streams and ignores the old stream', async (): Promise<void> => {
		const replacement = new BehaviorSubject<DateTimeSlot[]>([
			slot('replacement', new Date('2026-12-22T11:00:00')),
		]);
		fixture.componentRef.setInput(
			'availableSlots',
			replacement.asObservable(),
		);
		await fixture.whenStable();

		expect(
			component.availableSlotsByDay(component.availableDays()[0]),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'replacement' }),
			]),
		);
		slots.next([slot('old-stream', new Date('2026-12-23T11:00:00'))]);
		await fixture.whenStable();
		expect(component.availableDays()).toHaveLength(1);
		expect(
			component.availableSlotsByDay(component.availableDays()[0])[0].id,
		).toBe('replacement');
	});

	it('reports availability and dismisses with the selected action', async (): Promise<void> => {
		const selected = slot('selected', new Date('2026-12-20T11:00:00'));

		expect(
			component.spotsRemaining({ ...selected, slotsReserved: 2 }),
		).toBe('1 spot');
		expect(component.spotsRemaining({ ...selected, enabled: false })).toBe(
			'Unavailable',
		);
		expect(component.isCurrentSlot(component.currentSlotValue()!)).toBe(
			true,
		);
		expect(component.isCurrentSlot(selected)).toBe(false);

		await component.cancel();
		await component.selectSlot(selected);

		expect(modalController.dismiss).toHaveBeenNthCalledWith(
			1,
			null,
			'cancel',
		);
		expect(modalController.dismiss).toHaveBeenNthCalledWith(
			2,
			selected,
			'confirm',
		);
	});
});
