import { TestBed } from '@angular/core/testing';
import {
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
} from '../../../test-helpers';

import { CheckedInGuard } from './checked-in.guard';

describe('CheckedInGuard', () => {
	let guard: CheckedInGuard;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
			],
		});
		guard = TestBed.inject(CheckedInGuard);
	});

	it('should be created', () => {
		expect(guard).toBeTruthy();
	});
});
