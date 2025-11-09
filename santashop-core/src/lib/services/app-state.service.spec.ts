import { TestBed } from '@angular/core/testing';
import { AppStateService } from './app-state.service';
import { FireRepoLite } from './fire-repo-lite.service';
import { of } from 'rxjs';

describe('AppStateService', () => {
	let service: AppStateService;

	beforeEach(() => {
		const mockFireRepoLite = {
			collection: jasmine.createSpy('collection').and.returnValue({
				read: jasmine.createSpy('read').and.returnValue(of(null)),
			}),
		};

		TestBed.configureTestingModule({
			providers: [
				AppStateService,
				{ provide: FireRepoLite, useValue: mockFireRepoLite },
			],
		});
		service = TestBed.inject(AppStateService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});
