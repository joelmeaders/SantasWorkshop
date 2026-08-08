import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, ModalController } from '@ionic/angular';
import type { Child } from '@santashop/models';
import { ManageChildrenComponent } from './manage-children.component';
import {
	provideModalControllerMock,
	provideAlertControllerMock,
} from '../../../../test-helpers';

describe('ManageChildrenComponent', () => {
	let component: ManageChildrenComponent;
	let fixture: ComponentFixture<ManageChildrenComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ManageChildrenComponent],
			providers: [
				provideModalControllerMock(),
				provideAlertControllerMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ManageChildrenComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('emits added and edited children from the modal result', async () => {
		const modal = TestBed.inject(ModalController) as any;
		const added = vi.fn(); const edited = vi.fn();
		component.adddedChild.subscribe(added); component.editedChild.subscribe(edited);
		modal.create
			.mockResolvedValueOnce({ present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'add', data: { id: 1 } }) })
			.mockResolvedValueOnce({ present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'edit', data: { id: 2 } }) });
		await component.addEditChild();
		await component.addEditChild({ id: 2 } as Child);
		expect(added).toHaveBeenCalledWith({ id: 1 });
		expect(edited).toHaveBeenCalledWith({ id: 2 });
	});

	it('confirms removal only for an existing child', async () => {
		fixture.componentRef.setInput('children', [{ id: 5, firstName: 'Holly', lastName: 'Jolly' } as Child]);
		const alert = TestBed.inject(AlertController) as any;
		const removed = vi.fn(); component.removedChild.subscribe(removed);
		alert.create.mockResolvedValue({ present: vi.fn(), onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }) });
		await component.removeChild(5);
		await component.removeChild(99);
		expect(removed).toHaveBeenCalledWith(5);
		expect(alert.create).toHaveBeenCalledOnce();
	});
});
