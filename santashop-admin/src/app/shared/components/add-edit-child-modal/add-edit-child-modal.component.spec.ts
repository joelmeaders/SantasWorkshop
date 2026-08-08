import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, ModalController } from '@ionic/angular';
import { AgeGroup, ToyType, type Child } from '@santashop/models';
import { AddEditChildModalComponent } from './add-edit-child-modal.component';
import {
	provideAlertControllerMock,
	provideModalControllerMock,
} from '../../../../test-helpers';

describe('AddEditChildModalComponent', () => {
	let component: AddEditChildModalComponent;
	let fixture: ComponentFixture<AddEditChildModalComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [AddEditChildModalComponent],
			providers: [
				provideModalControllerMock(),
				provideAlertControllerMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(AddEditChildModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('initializes an Ionic component prop as an editable child', async () => {
		const child = {
			id: 17,
			firstName: 'Kid',
			lastName: 'Tester',
			dateOfBirth: new Date(`${new Date().getFullYear() - 4}-01-15T00:00:00`),
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
			child.dateOfBirth.toISOString().substring(0, 10),
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
		const year = new Date().getFullYear();

		await component.birthdaySelected({ detail: { value: `${year - 1}-06-01` } });
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age02);
		expect(component.form.controls['toyType'].value).toBe(ToyType.infant);

		await component.birthdaySelected({ detail: { value: `${year - 4}-06-01` } });
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age35);
		await component.birthdaySelected({ detail: { value: `${year - 7}-06-01` } });
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age68);
		await component.birthdaySelected({ detail: { value: `${year - 10}-06-01` } });
		expect(component.form.controls['ageGroup'].value).toBe(AgeGroup.age911);
	});

	it('alerts and clears an over-age birthday', async () => {
		const alerts = TestBed.inject(AlertController) as Mocked<AlertController>;
		alerts.create.mockResolvedValue({
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue(undefined),
		} as unknown as HTMLIonAlertElement);

		await component.birthdaySelected({ detail: { value: `${new Date().getFullYear() - 12}-01-01` } });

		expect(alerts.create).toHaveBeenCalledWith(
			expect.objectContaining({ header: 'This child is too old' }),
		);
		expect(component.form.controls['dateOfBirth'].value).toBeUndefined();
	});

	it('saves a form child as an add result and cancels without a child', async () => {
		const modal = TestBed.inject(ModalController) as Mocked<ModalController>;
		component.form.setValue({
			id: null,
			firstName: 'Taylor',
			lastName: 'Tester',
			dateOfBirth: `${new Date().getFullYear() - 6}-05-01`,
			ageGroup: AgeGroup.age68,
			toyType: ToyType.boy,
		});
		vi.spyOn(Math, 'random').mockReturnValue(0.5);

		await component.saveChild();
		await component.dismiss();

		expect(modal.dismiss).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ id: 50000, firstName: 'Taylor', dateOfBirth: expect.any(Date) }),
			'add',
		);
		expect(modal.dismiss).toHaveBeenLastCalledWith(undefined, 'cancelled');
	});
});
