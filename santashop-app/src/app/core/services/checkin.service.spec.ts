import { TestBed } from '@angular/core/testing';
import {
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
} from '../../../test-helpers';
import { CheckinService } from './checkin.service';

describe('CheckinService', () => {
	let service: CheckinService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
			],
		});
		service = TestBed.inject(CheckinService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
