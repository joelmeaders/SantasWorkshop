import {} from 'jasmine';
import { TestBed } from '@angular/core/testing';
import { SkeletonStateService } from './skeleton-state.service';
import { SkeletonStateError } from '../errors/skeleton-state-service';
import { SkeletonState } from '.';
import { finalize, skip } from 'rxjs';

describe('SkeletonStateService', () => {
	let service: SkeletonStateService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [SkeletonStateService],
		});
		service = TestBed.inject(SkeletonStateService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('addState', () => {
		it('should return new state after adding', () => {
			const newState = service.addState('id1', 'group1');
			expect(newState.id).toEqual('id1');
			expect(newState.groupId).toEqual('group1');
		});

		it('should add a new state to the states stack', () => {
			const spy = spyOn<any>(service['state'], 'push').and.callThrough();
			const newState = service.addState('a', 'b');
			expect(service['state']).toHaveSize(1);
			expect(spy).toHaveBeenCalledOnceWith(newState);
			expect(service['state'][0]).toBe(newState);
		});
	});

	describe('getState', () => {
		beforeEach(() => {
			service.addState('a', 'b');
		});

		it('should get requested state by id', () => {
			const state = service.getState('a');
			expect(state).toBeTruthy();
			expect(state.id).toEqual('a');
		});

		it('should get requested state by id and group', () => {
			const state = service.getState('a', 'b');
			expect(state).toBeTruthy();
			expect(state.id).toEqual('a');
			expect(state.groupId).toEqual('b');
		});

		it("should add state if it doesn't exist", () => {
			const state = service.getState('c', 'd');
			expect(state).toBeTruthy();
			expect(state.id).toEqual('c');
			expect(state.groupId).toEqual('d');
		});

		it('should throw error on missing state', () => {
			expect(function () {
				service.getState('c', 'd', false);
			}).toThrow(
				new SkeletonStateError(
					`getState(): State with id "c" and group "d" not found`,
				),
			);
		});
	});

	describe('removeState', () => {
		beforeEach(() => {
			service.addState('a', 'b');
			service.addState('c', 'd');
			service.addState('b', 'b');
		});

		it('should call removeStateById()', () => {
			const spy = spyOn(service, 'removeStateById').and.callThrough();
			service.removeState('a');
			expect(spy).toHaveBeenCalledOnceWith('a');
		});

		it('should call removeStatesByGroup()', () => {
			const spy = spyOn(service, 'removeStatesByGroup').and.callThrough();
			service.removeState(undefined, 'b');
			expect(spy).toHaveBeenCalledOnceWith('b');
		});

		it('should remove state from stack', () => {
			const spy = spyOn(service['state'], 'splice').and.callThrough();
			service.removeState('a', 'b');
			expect(spy).toHaveBeenCalledOnceWith(0, 1);
			expect(service['state']).toHaveSize(2);
		});

		it('should do nothing', () => {
			service.removeState('f', 'h');
			expect(service['state']).toHaveSize(3);
		});
	});

	describe('removeStateById', () => {
		beforeEach(() => {
			service.addState('a', 'b');
			service.addState('c', 'd');
			service.addState('b', 'b');
		});

		it('should remove state from stack', () => {
			const spy = spyOn(service['state'], 'splice').and.callThrough();
			service.removeStateById('c');
			expect(spy).toHaveBeenCalledOnceWith(1, 1);
			expect(service['state']).toHaveSize(2);
		});

		it('should do nothing', () => {
			service.removeState('f');
			expect(service['state']).toHaveSize(3);
		});
	});

	describe('removeStatesByGroup', () => {
		beforeEach(() => {
			service.addState('a', 'b');
			service.addState('c', 'd');
			service.addState('b', 'b');
		});

		it('should remove state from stack', () => {
			const spy = spyOn(service['state'], 'splice').and.callThrough();
			service.removeStatesByGroup('b');
			expect(spy).toHaveBeenCalledWith(0, 1);
			expect(spy).toHaveBeenCalledWith(1, 1);
			expect(spy).toHaveBeenCalledTimes(2);
			expect(service['state'].length).toBe(1);
		});

		it('should do nothing', () => {
			service.removeStatesByGroup('f');
			expect(service['state']).toHaveSize(3);
		});
	});
});

describe('SkeletonState', () => {
	it('should be initialized with correct values', () => {
		const state = new SkeletonState('a', 'b');
		expect(state.id).toBe('a');
		expect(state.groupId).toBe('b');
		expect(state['_isLoaded$'].getValue()).toBeFalse();
	});

	it('setState should cause true emission', () => {
		const state = new SkeletonState('a', 'b');
		let done = false;

		state.isLoaded$.pipe(skip(1)).subscribe((value) => (done = value));

		state.setState(true);
		state.destroy();

		expect(done).toBeTrue();
	});

	it('should kill _isLoaded$', () => {
		const state = new SkeletonState('a', 'b');
		let done = false;

		state.isLoaded$.pipe(finalize(() => (done = true))).subscribe();

		state.destroy();
		expect(done).toBeTrue();
	});
});
