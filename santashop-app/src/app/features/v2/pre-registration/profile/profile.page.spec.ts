import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import {
	autoSpyProvider,
	getFunctionSpy,
	getPropertySpy,
	Spied,
} from '../../../../../../../test-helpers';
import { mockUsers } from '../../../../../../../test-helpers/mock-data';
import { provideTranslateServiceMock } from '../../../../../test-helpers';

import { ProfilePage } from './profile.page';
import { ProfilePageService } from './profile.page.service';
import { changeEmailForm, changePasswordForm } from './profile.form';
import { newChangeInfoForm } from './change-info/change-info.form';

describe('ProfilePage', () => {
	let component: ProfilePage;
	let fixture: ComponentFixture<ProfilePage>;

	const viewService: Spied<ProfilePageService> =
		autoSpyProvider(ProfilePageService).useValue;

	const providers = [
		{ provide: ProfilePageService, useValue: viewService },
		{
			provide: ActivatedRoute,
			useValue: { snapshot: { paramMap: { get: (): null => null } } },
		},
	];

	const userProfile$Spy: jasmine.Spy = getPropertySpy(
		viewService,
		'userProfile$',
	).and.returnValue(of(mockUsers().user1));

	getPropertySpy(viewService, 'profileForm').and.returnValue(newChangeInfoForm());
	getPropertySpy(viewService, 'changeEmailForm').and.returnValue(changeEmailForm());
	getPropertySpy(viewService, 'changePasswordForm').and.returnValue(changePasswordForm());

	beforeEach(waitForAsync(async (): Promise<void> => {
		TestBed.overrideComponent(ProfilePage, {
			set: {
				providers: providers,
			},
		});
		await TestBed.configureTestingModule({
			imports: [ProfilePage],
			providers: [provideTranslateServiceMock()],
		}).compileComponents();

		fixture = TestBed.createComponent(ProfilePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('profileForm: should be expected reference', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'profileForm');

		// Act
		const result = component.profileForm;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.profileForm);
	});

	it('changeEmailForm: should be expected reference', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'changeEmailForm');

		// Act
		const result = component.changeEmailForm;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.changeEmailForm);
	});

	it('changePasswordForm: should be expected reference', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'changePasswordForm');

		// Act
		const result = component.changePasswordForm;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.changePasswordForm);
	});

	it('userProfile$: should be expected reference', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'userProfile$');

		// Act
		const result = component.userProfile$;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.userProfile$);
	});

	it('userProfile$: should return expected value', async () => {
		// Arrange & Act
		const result = await firstValueFrom(component.userProfile$);

		// Assert
		expect(userProfile$Spy).toHaveBeenCalled();
		expect(result.uid).toBe('ABC123');
	});

	it('updateProfile(): should make expected call', async () => {
		// Arrange
		const methodSpy = getFunctionSpy(
			viewService,
			'updatePublicProfile',
		).and.resolveTo();

		// Act
		await component.updateProfile();

		// Assert
		expect(methodSpy).toHaveBeenCalled();
	});

	it('changeEmailAddress(): should make expected call', async () => {
		// Arrange
		const methodSpy = getFunctionSpy(
			viewService,
			'changeEmailAddress',
		).and.resolveTo();

		// Act
		await component.changeEmailAddress();

		// Assert
		expect(methodSpy).toHaveBeenCalled();
	});

	it('changePassword(): should make expected call', async () => {
		// Arrange
		const methodSpy = getFunctionSpy(
			viewService,
			'changePassword',
		).and.resolveTo();

		// Act
		await component.changePassword();

		// Assert
		expect(methodSpy).toHaveBeenCalled();
	});
});
