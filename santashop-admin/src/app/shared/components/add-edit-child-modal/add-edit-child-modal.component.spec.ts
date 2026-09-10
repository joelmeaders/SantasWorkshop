import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { AgeGroup, ToyType, type Child } from '@santashop/models';
import { PROGRAM_YEAR } from '@santashop/core/admin/firestore';
import { AddEditChildModalComponent } from './add-edit-child-modal.component';
import {
	provideAlertControllerMock,
	provideModalControllerMock,
} from '../../../../test-helpers';

describe('AddEditChildModalComponent', () => {
	const programYear = 2030;
	let component: AddEditChildModalComponent;
	let fixture: ComponentFixture<AddEditChildModalComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [AddEditChildModalComponent],
			providers: [
				{ provide: PROGRAM_YEAR, useValue: programYear },
				provideModalControllerMock(),
				provideAlertControllerMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(AddEditChildModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('uses configured-year bounds, not the machine year', () => {
		expect(component.minBirthDate).toBe('2019-01-01');
		expect(component.maxBirthDate).toBe('2030-12-31');
	});

	it('accepts 25 last-name characters and rejects 26', () => {
		const lastName = component.form.controls['lastName'];
		lastName.setValue('A'.repeat(25));
		expect(lastName.valid).toBe(true);
		lastName.setValue('A'.repeat(26));
		expect(lastName.hasError('maxlength')).toBe(true);
	});

	it('accepts the youngest eligible birthday with infant defaults', async () => {
		await component.birthdaySelected({ detail: { value: '2030-12-31' } });
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age02);
		expect(component.form.controls['toyType'].value).toBe(ToyType.infant);
		expect(TestBed.inject(AlertController).create).not.toHaveBeenCalled();
	});

	it('provides programmatic labels for child fields', () => {
		const inputs = fixture.nativeElement.querySelectorAll(
			'ion-input',
		) as NodeListOf<HTMLIonInputElement>;

		expect([...inputs].map((input) => input.label)).toEqual([
			'First Name',
			'Last Name',
			'Birth Date',
		]);
	});

	it('initializes an Ionic component prop as an editable child', async () => {
		const child = {
			id: 17,
			firstName: 'Kid',
			lastName: 'Tester',
			dateOfBirth: new Date(`${programYear - 4}-01-15T00:00:00`),
			ageGroup: AgeGroup.age35,
			toyType: ToyType.girl,
			enabled: true,
		} satisfies Child;
		const editFixture = TestBed.createComponent(AddEditChildModalComponent);
		editFixture.componentRef.setInput('child', child);

		await editFixture.whenStable();

		const editComponent = editFixture.componentInstance;
		expect(editComponent.form.controls['firstName'].value).toBe('Kid');
		expect(editComponent.form.controls['lastName'].value).toBe('Tester');
		expect(editComponent.form.controls['dateOfBirth'].value).toBe(
			`${programYear - 4}-01-15`,
		);
		expect(editComponent.form.controls['ageGroup'].value).toBe(
			AgeGroup.age35,
		);
	});

	it('dismisses an edited child with the edit role', async () => {
		const modalController = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;
		const child = {
			id: 17,
			firstName: 'Kid',
			lastName: 'Tester',
			dateOfBirth: new Date(),
			enabled: true,
		} satisfies Child;

		await component.dismiss(child);

		expect(modalController.dismiss).toHaveBeenCalledWith(child, 'edit');
	});

	it('assigns a stable id and add role to a new child', async () => {
		const modalController = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;
		vi.spyOn(Math, 'random').mockReturnValue(0.12345);
		const child: Child = {
			firstName: 'New',
			lastName: 'Child',
			dateOfBirth: new Date(),
			enabled: true,
		};

		await component.dismiss(child);

		expect(child.id).toBe(12345);
		expect(modalController.dismiss).toHaveBeenCalledWith(child, 'add');
	});

	it('sets infant defaults and calculates each school-age band from a birthday', async () => {
		const year = programYear;

		await component.birthdaySelected({
			detail: { value: `${year - 1}-06-01` },
		});
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age02);
		expect(component.form.controls['toyType'].value).toBe(ToyType.infant);

		await component.birthdaySelected({
			detail: { value: `${year - 4}-06-01` },
		});
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age35);
		await component.birthdaySelected({
			detail: { value: `${year - 7}-06-01` },
		});
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age68);
		await component.birthdaySelected({
			detail: { value: `${year - 10}-06-01` },
		});
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age911);
	});

	it('clears the infant toy type when the child becomes school age', async () => {
		const year = programYear;

		await component.birthdaySelected({
			detail: { value: `${year - 1}-06-01` },
		});
		expect(component.form.controls['toyType'].value).toBe(ToyType.infant);

		await component.birthdaySelected({
			detail: { value: `${year - 4}-06-01` },
		});

		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age35);
		expect(component.form.controls['toyType'].value).toBeUndefined();
		expect(component.form.controls['toyType'].invalid).toBe(true);
	});

	it('alerts and clears an over-age birthday', async () => {
		const alerts = TestBed.inject(
			AlertController,
		) as Mocked<AlertController>;
		alerts.create.mockResolvedValue({
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue(undefined),
		} as unknown as HTMLIonAlertElement);

		await component.birthdaySelected({
			detail: { value: `${programYear - 12}-12-31` },
		});

		expect(alerts.create).toHaveBeenCalledWith(
			expect.objectContaining({ header: 'This child is too old' }),
		);
		expect(component.form.controls['dateOfBirth'].value).toBeUndefined();
	});

	it('accepts an eleven-year-old consistently with customer registration', async () => {
		await component.birthdaySelected({
			detail: { value: `${programYear - 11}-01-01` },
		});

		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age911);
		expect(TestBed.inject(AlertController).create).not.toHaveBeenCalled();
	});

	it('preserves the local birthday when only the child name is edited', async () => {
		const year = programYear - 8;
		const originalBirthday = new Date(year, 5, 15);
		const editFixture = TestBed.createComponent(AddEditChildModalComponent);
		editFixture.componentRef.setInput('child', {
			id: 17,
			firstName: 'Before',
			lastName: 'Tester',
			dateOfBirth: originalBirthday,
			ageGroup: AgeGroup.age68,
			toyType: ToyType.girl,
			enabled: true,
		} satisfies Child);
		await editFixture.whenStable();
		editFixture.componentInstance.form.controls['firstName'].setValue(
			'After',
		);

		await editFixture.componentInstance.saveChild();

		expect(TestBed.inject(ModalController).dismiss).toHaveBeenCalledWith(
			expect.objectContaining({
				firstName: 'After',
				dateOfBirth: originalBirthday,
			}),
			'edit',
		);
		expect(editFixture.componentInstance.minBirthDate).toMatch(
			/^\d{4}-\d{2}-\d{2}$/,
		);
		expect(editFixture.componentInstance.maxBirthDate).toMatch(
			/^\d{4}-\d{2}-\d{2}$/,
		);
	});

	it('preserves a legacy UTC-midnight birthday when only the child name is edited', async () => {
		const year = programYear - 8;
		const legacyBirthday = new Date(Date.UTC(year, 5, 15));
		const editFixture = TestBed.createComponent(AddEditChildModalComponent);
		editFixture.componentRef.setInput('child', {
			id: 17,
			firstName: 'Before',
			lastName: 'Tester',
			dateOfBirth: legacyBirthday,
			ageGroup: AgeGroup.age68,
			toyType: ToyType.girl,
			enabled: true,
		} satisfies Child);
		await editFixture.whenStable();

		expect(
			editFixture.componentInstance.form.controls['dateOfBirth'].value,
		).toBe(`${year}-06-15`);
		editFixture.componentInstance.form.controls['firstName'].setValue(
			'After',
		);

		await editFixture.componentInstance.saveChild();

		const savedChild = (
			TestBed.inject(ModalController) as Mocked<ModalController>
		).dismiss.mock.calls.at(-1)?.[0] as Child;
		expect(savedChild.dateOfBirth).toEqual(new Date(year, 5, 15));
	});

	it('saves a form child as an add result and cancels without a child', async () => {
		const modal = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;
		component.form.setValue({
			id: null,
			firstName: 'Taylor',
			lastName: 'Tester',
			dateOfBirth: `${programYear - 6}-05-01`,
			ageGroup: AgeGroup.age68,
			toyType: ToyType.boy,
		});
		vi.spyOn(Math, 'random').mockReturnValue(0.5);

		await component.saveChild();
		await component.dismiss();

		expect(modal.dismiss).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				id: 50000,
				firstName: 'Taylor',
				dateOfBirth: expect.any(Date),
			}),
			'add',
		);
		expect(modal.dismiss).toHaveBeenLastCalledWith(undefined, 'cancelled');
	});
});
