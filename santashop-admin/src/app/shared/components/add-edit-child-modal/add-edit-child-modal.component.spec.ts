import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
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
});
