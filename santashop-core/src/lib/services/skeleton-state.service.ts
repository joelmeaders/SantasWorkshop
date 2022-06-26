import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, shareReplay, Subject, takeUntil } from 'rxjs';
import { SkeletonStateError } from '../errors/skeleton-state-service';

@Injectable()
export class SkeletonStateService implements OnDestroy {

  /**
   * Internal state array
   *
   * @private
   * @type {SkeletonState[]}
   * @memberof SkeletonStateService
   */
  private readonly state: SkeletonState[] = [];

  /**
   * Runs on destroy and clears out states 
   * and subscriptions to those states.
   *
   * @memberof SkeletonStateService
   */
  ngOnDestroy(): void {
    this.state.forEach((state) => {
      state.destroy();
    });
  }

  /**
   * Adds a new state
   *
   * @param id
   * @param [groupId]
   * @return
   * @memberof SkeletonStateService
   */
  public addState(id: string, groupId?: string): SkeletonState {
    const newState = new SkeletonState(id, groupId);
    this.state.push(newState);
    return newState;
  }

  /**
   * Returns a state by id and group. If the state 
   * doesn't exist it will be created and returned.
   *
   * @param id
   * @param [groupId]
   * @return
   * @memberof SkeletonStateService
   */
  public getState(id: string, groupId?: string, createIfNotFound = true): SkeletonState {

    let states: SkeletonState[] = [];

    states = groupId 
      ? this.state.filter(s => s.groupId === groupId)
      : this.state;

    let requestedState = states.find(s => s.id === id);

    if (!requestedState) {
      if (createIfNotFound) {
        requestedState = this.addState(id, groupId)
      } else {
        throw new SkeletonStateError(`getState(): State with id "${id}" and group "${groupId}" not found`);
      }
    }

    return requestedState;
  }

  /**
   * Remove a state from the state stack.
   *
   * @param id
   * @param [groupId]
   * @memberof SkeletonStateService
   */
  public removeState(id?: string, groupId?: string): void {

    if (!id && !groupId) 
      throw new RangeError("Both id and groupId cannot be undefined");

    if (id && !groupId) 
      return this.removeStateById(id);

    if (!id && groupId) 
      return this.removeStatesByGroup(groupId);

    const toDelete: number[] = [];

    this.state.forEach((state, index) => {
      if (state.id === id && state.groupId === groupId) {
        state.destroy();
        toDelete.push(index);
      }
    });

    toDelete.forEach(index => this.state.splice(index, 1));
  }

  public removeStateById(id: string): void {
    const index = this.state.findIndex(s => s.id === id);
    if (index > -1) this.state.splice(index, 1)
  }

  public removeStatesByGroup(groupId: string): void {
    this.state.forEach((state, index) => {
      if (state.groupId === groupId) {
        state.destroy();
        this.state.splice(index, 1)
      }
    });
  }
}

export class SkeletonState {
  public readonly id: string;
  public readonly groupId?: string;
  private readonly _isLoaded$ = new BehaviorSubject<boolean>(false);
  private readonly destroy$ = new Subject<void>();

  public readonly isLoaded$ = this._isLoaded$.asObservable().pipe(
    takeUntil(this.destroy$),
    shareReplay(1)
  );

  constructor(id: string, groupId?: string) {
    this.id = id;
    this.groupId = groupId;
  }

  public setState(isLoaded: boolean) {
    this._isLoaded$.next(isLoaded);
  }

  public destroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}