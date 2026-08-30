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
import { AlertController, ModalController } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import type { StaffAccount } from '@santashop/models';
import { StaffService } from './staff.service';
import { AuthService } from '@santashop/core';
import {
	provideActivatedRouteMock,
	provideAlertControllerMock,
	provideLoadingControllerMock,
	provideModalControllerMock,
} from '../../../../test-helpers';
import { UsersPage } from './users.page';

describe('UsersPage', () => {
	let component: UsersPage;
	let fixture: ComponentFixture<UsersPage>;
	let staffService: Mocked<StaffService> & {
		staffAccounts$: Observable<StaffAccount[]>;
	};

	beforeEach(async () => {
		staffService = {
			createStaffUser: vi.fn().mockName('StaffService.createStaffUser'),
			updateStaffUser: vi.fn().mockName('StaffService.updateStaffUser'),
			deleteStaffUser: vi.fn().mockName('StaffService.deleteStaffUser'),
		} as unknown as Mocked<StaffService> & {
			staffAccounts$: Observable<StaffAccount[]>;
		};
		staffService.staffAccounts$ = of([]);
		staffService.createStaffUser.mockResolvedValue('staff-1');
		staffService.updateStaffUser.mockResolvedValue(undefined);
		staffService.deleteStaffUser.mockResolvedValue(undefined);

		await TestBed.configureTestingModule({
			imports: [UsersPage],
			providers: [
				provideRouter([]),
				provideActivatedRouteMock(),
				provideAlertControllerMock(),
				provideLoadingControllerMock(),
				provideModalControllerMock(),
				{ provide: StaffService, useValue: staffService },
				{
					provide: AuthService,
					useValue: { isOwner$: of(true) },
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(UsersPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('exposes a staff accounts stream', () => {
		expect(component.staffAccounts$).toBeDefined();
	});

	it('maps role keys to friendly labels', () => {
		expect(component.roleLabel('admin')).toBe('Administrator');
		expect(component.roleLabel('checkin')).toBe('Check-In');
	});

	it('opens the editor modal when adding a user', async () => {
		const modalController = TestBed.inject(ModalController);

		await component.addUser();

		expect(modalController.create).toHaveBeenCalled();
	});

	it('creates a user when the modal returns a create result', async () => {
		const modalController = TestBed.inject(ModalController);
		(modalController.create as unknown as MockInstance).mockResolvedValue({
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({
				role: 'create',
				data: {
					emailAddress: 'staff@example.com',
					displayName: 'Staff Member',
					password: 'Password123!',
					roles: ['checkin'],
				},
			}),
		} as unknown as HTMLIonModalElement);

		await component.addUser();

		expect(staffService.createStaffUser).toHaveBeenCalledWith(
			expect.objectContaining({
				emailAddress: 'staff@example.com',
			}),
		);
	});

	it('updates a password when the reset-password alert is confirmed', async () => {
		const alerts = TestBed.inject(AlertController);
		(alerts.create as unknown as MockInstance).mockImplementation((config: unknown) => {
			const saveButton = (
				config as {
					buttons: {
						text: string;
						handler?: (value: { password?: string }) => boolean;
					}[];
				}
			).buttons.find((button) => button.text === 'Save');
			saveButton?.handler?.({ password: 'Password123!' });

			return Promise.resolve({
				present: vi.fn().mockResolvedValue(undefined),
				onDidDismiss: vi.fn().mockResolvedValue({ role: 'confirm' }),
			} as unknown as HTMLIonAlertElement);
		});

		await component.resetPassword({
			uid: 'staff-1',
			displayName: 'Staff Member',
			emailAddress: 'staff@example.com',
			roles: ['checkin'],
			disabled: false,
			createdOn: new Date(),
			updatedOn: new Date(),
		});

		expect(staffService.updateStaffUser).toHaveBeenCalledWith({
			uid: 'staff-1',
			newPassword: 'Password123!',
		});
	});

	it('deletes a user when the confirmation alert is accepted', async () => {
		const alerts = TestBed.inject(AlertController);
		(alerts.create as unknown as MockInstance).mockResolvedValue({
			present: vi.fn().mockResolvedValue(undefined),
			onDidDismiss: vi.fn().mockResolvedValue({ role: 'destructive' }),
		} as unknown as HTMLIonAlertElement);

		await component.deleteUser({
			uid: 'staff-1',
			displayName: 'Staff Member',
			emailAddress: 'staff@example.com',
			roles: ['checkin'],
			disabled: false,
			createdOn: new Date(),
			updatedOn: new Date(),
		});

		expect(staffService.deleteStaffUser).toHaveBeenCalledWith('staff-1');
	});
});
