import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Registration } from '../../../../../../../dist/santashop-models';
import {
	getFunctionSpy,
	getPropertySpy,
	autoSpyProvider,
	Spied,
} from '../../../../../../../test-helpers';
import {
	mockChildren,
	mockRegistrations,
} from '../../../../../../../test-helpers/mock-data';
import { PreRegistrationService } from '../../../../core';
import { ChildrenPageService } from './children.page.service';

describe('ChildrenPageService', () => {
	let service: ChildrenPageService;
	let preregistrationService: Spied<PreRegistrationService>;

	let childrenSpy: jasmine.Spy;

	beforeEach(() => {
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				autoSpyProvider(PreRegistrationService),
				ChildrenPageService,
			],
		});

		preregistrationService = TestBed.inject(
			PreRegistrationService
		) as jasmine.SpyObj<PreRegistrationService>;
	});

	beforeEach(() => {
		childrenSpy = getPropertySpy(preregistrationService, 'children$');

		childrenSpy.and.returnValue(
			of([
				mockChildren.valid.infant,
				mockChildren.valid.age35,
				mockChildren.valid.age68,
				mockChildren.valid.age911,
			])
		);

		service = TestBed.inject(ChildrenPageService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('children$: should make expected call and return 4', async () => {
		// Arrange & Act
		var result = await firstValueFrom(service.children$);

		// Assert
		expect(childrenSpy).toHaveBeenCalledTimes(1);
		expect(result?.length).toBe(4);
	});

	it('childCount$: should return 4', async () => {
		// Arrange & Act
		var result = await firstValueFrom(service.childCount$);

		// Assert
		expect(childrenSpy).toHaveBeenCalledTimes(1);
		expect(result).toBe(4);
	});

	it('removeChild(): makes expected calls', async () => {
		// Arrange
		const childToRemove = mockChildren.valid.age35;
		const updateSpy = spyOn(service, 'updateRegistration');
		updateSpy.and.resolveTo();

		// Act
		await service.removeChild(childToRemove);

		// Assert
		expect(childrenSpy).toHaveBeenCalledTimes(1);
		expect(updateSpy).toHaveBeenCalledWith([
			mockChildren.valid.infant,
			mockChildren.valid.age68,
			mockChildren.valid.age911,
		]);
	});

	it('updateRegistration(): makes expected calls', async () => {
		// Arrange
		const updatedChildren = [
			mockChildren.valid.infant,
			mockChildren.valid.age35,
		];

		const registrationMock = {
			...mockRegistrations('1').complete.mockRegistration1,
		} as Registration;

		const registrationSpy = getPropertySpy(
			preregistrationService,
			'userRegistration$'
		);
		registrationSpy.and.returnValue(of(registrationMock));

		const saveRegistrationSpy = getFunctionSpy(
			preregistrationService,
			'saveRegistration'
		);
		saveRegistrationSpy.and.returnValue(of());

		// Act
		await service.updateRegistration(updatedChildren);

		// Assert
		expect(childrenSpy).toHaveBeenCalledTimes(1);
		expect(registrationSpy).toHaveBeenCalledTimes(1);
		expect(saveRegistrationSpy).toHaveBeenCalledWith({
			...registrationMock,
			children: updatedChildren,
		});
	});
});
