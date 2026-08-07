import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppStateService } from './app-state.service';
import { FireRepoLite } from './fire-repo-lite.service';
import { of } from 'rxjs';

vi.mock('firebase/firestore', () => ({
	addDoc: vi.fn(),
	collection: vi.fn(),
	deleteDoc: vi.fn(),
	doc: vi.fn(),
	onSnapshot: vi.fn(),
	query: vi.fn(),
	setDoc: vi.fn(),
	Timestamp: class {},
}));

describe('AppStateService', () => {
	let service: AppStateService;

	beforeEach(() => {
		const mockFireRepoLite = {
			collection: vi
				.fn()
				.mockName('collection')
				.mockReturnValue({
					read: vi.fn().mockName('read').mockReturnValue(of(null)),
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
