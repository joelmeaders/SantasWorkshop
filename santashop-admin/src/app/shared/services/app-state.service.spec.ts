import { TestBed } from '@angular/core/testing';
import { AppStateService } from './app-state.service';
import { provideFirestoreWrapperMock } from '../../../test-helpers';

describe('AppStateService', () => {
	let service: AppStateService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideFirestoreWrapperMock()],
		});
		service = TestBed.inject(AppStateService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
