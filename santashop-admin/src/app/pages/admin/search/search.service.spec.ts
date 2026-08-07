import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SearchService } from './search.service';
import { provideFirestoreWrapperMock } from '../../../../test-helpers';

describe('SearchService', () => {
	let service: SearchService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideFirestoreWrapperMock()],
		});
		service = TestBed.inject(SearchService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
