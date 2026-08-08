import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { provideModalControllerMock } from '../../../../test-helpers';
import type { StaffAccount } from '@santashop/models';
import { UserEditorComponent } from './user-editor.component';

describe('UserEditorComponent', () => {
	let component: UserEditorComponent;
	let fixture: ComponentFixture<UserEditorComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [UserEditorComponent],
			providers: [provideModalControllerMock()],
		}).compileComponents();

		fixture = TestBed.createComponent(UserEditorComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('normalizes admin-only role selections on create', async () => {
		const modalController = TestBed.inject(ModalController);

		component.form.controls['emailAddress'].setValue('staff@example.com');
		component.form.controls['displayName'].setValue('Staff Member');
		component.form.controls['roles'].setValue(['admin']);
		component.form.controls['password'].setValue('Password123!');

		await component.save();

		expect(modalController.dismiss).toHaveBeenCalledWith(
			expect.objectContaining({
				roles: ['admin', 'checkin'],
			}),
			'create',
		);
	});

	it('normalizes legacy admin-only accounts when editing', async () => {
		const account: StaffAccount = {
			uid: 'staff-1',
			displayName: 'Admin User',
			emailAddress: 'admin@example.com',
			roles: ['admin'],
			disabled: false,
			createdOn: new Date(),
			updatedOn: new Date(),
		};

		fixture = TestBed.createComponent(UserEditorComponent);
		component = fixture.componentInstance;
		component.account = account;
		await fixture.whenStable();

		expect(component.form.controls['roles'].value).toEqual([
			'admin',
			'checkin',
		]);
	});

	it('updates an existing account, including an optional password, and can cancel', async () => {
		const modalController = TestBed.inject(ModalController);
		component.account = {
			uid: 'staff-2', displayName: 'Check-In Staff', emailAddress: 'staff@example.com',
			roles: ['checkin'], disabled: false, createdOn: new Date(), updatedOn: new Date(),
		};
		component.isOwner = true;
		component.ngOnInit();
		component.form.patchValue({ displayName: 'Updated Staff', roles: ['admin'], password: 'NewPassword!' });

		await component.save();
		await component.dismiss();

		expect(component.roleOptions.map((option) => option.value)).toEqual(['admin', 'checkin']);
		expect(modalController.dismiss).toHaveBeenNthCalledWith(1, {
			uid: 'staff-2', displayName: 'Updated Staff', roles: ['admin', 'checkin'], disabled: false, newPassword: 'NewPassword!',
		}, 'update');
		expect(modalController.dismiss).toHaveBeenNthCalledWith(2, undefined, 'cancelled');
	});

	it('marks invalid create forms as touched without dismissing', async () => {
		const modalController = TestBed.inject(ModalController);
		await component.save();
		expect(component.form.touched).toBe(true);
		expect(modalController.dismiss).not.toHaveBeenCalled();
	});
});
