import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
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
		fixture.detectChanges();
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
			jasmine.objectContaining({
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
		fixture.detectChanges();

		expect(component.form.controls['roles'].value).toEqual([
			'admin',
			'checkin',
		]);
	});
});