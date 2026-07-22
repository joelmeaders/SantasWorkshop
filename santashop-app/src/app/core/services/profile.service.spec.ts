import { TestBed } from '@angular/core/testing';
import {
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
} from '../../../test-helpers';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
	let service: ProfileService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideAuthMock(),
				provideFirestoreMock(),
				provideFunctionsMock(),
			],
		});
		service = TestBed.inject(ProfileService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
