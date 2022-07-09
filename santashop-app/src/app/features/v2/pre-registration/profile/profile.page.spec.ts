import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { IUser } from '../../../../../../../dist/santashop-models';
import { CoreModule } from '../../../../../../../santashop-core/src';
import {
	autoSpyProvider,
	getPropertySpy,
	Spied,
} from '../../../../../../../test-helpers';
import { PreRegistrationService } from '../../../../core';
import { SharedModule } from '../../../../shared/components/shared.module';

import { ProfilePage } from './profile.page';
import { ProfilePageService } from './profile.page.service';

describe('ProfilePage', () => {
	let component: ProfilePage;
	let fixture: ComponentFixture<ProfilePage>;

	let viewService: Spied<ProfilePageService>;
	let preregistrationService: Spied<PreRegistrationService>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ProfilePage],
			imports: [CoreModule, SharedModule],
			providers: [PreRegistrationService],
		});
		TestBed.overrideComponent(ProfilePage, {
			set: {
				providers: [
					autoSpyProvider(ProfilePageService),
					autoSpyProvider(PreRegistrationService),
				],
			},
		});
		TestBed.compileComponents();

		viewService = TestBed.inject(
			ProfilePageService
		) as jasmine.SpyObj<ProfilePageService>;

		preregistrationService = TestBed.inject(
			PreRegistrationService
		) as jasmine.SpyObj<PreRegistrationService>;

		fixture = TestBed.createComponent(ProfilePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('profileForm: should be expected value', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'profileForm');

		// Act
		const result = component.profileForm;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.profileForm);
	});

	it('changeEmailForm: should be expected value', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'changeEmailForm');

		// Act
		const result = component.changeEmailForm;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.changeEmailForm);
	});

	it('changePasswordForm: should be expected value', () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'changePasswordForm');

		// Act
		const result = component.changePasswordForm;

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result).toBe(viewService.changePasswordForm);
	});

	it('userProfile$: should be expected value', async () => {
		// Arrange
		const propertySpy = getPropertySpy(viewService, 'userProfile$');
		propertySpy.and.returnValue(of({ uid: 'ABC123' } as IUser));

		// Act
		const result = await firstValueFrom(component.userProfile$);

		// Assert
		expect(propertySpy).toHaveBeenCalled();
		expect(result.uid).toBe('ABC123');
	});

	it('should stfu', () => {
		getPropertySpy(viewService, 'profileForm');
		getPropertySpy(preregistrationService, 'registrationComplete$');
	});
});
