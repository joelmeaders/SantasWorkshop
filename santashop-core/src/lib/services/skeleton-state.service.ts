import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, shareReplay, Subject, takeUntil } from 'rxjs';

@Injectable()
export class SkeletonStateService implements OnDestroy {

  private readonly state: SkeletonState[] = [];

  ngOnDestroy(): void {
    this.state.forEach((state) => {
      state.destroy();
    });
  }

  public addState(id: string, groupId?: string): SkeletonState {
    const newState = new SkeletonState(id, groupId);
    this.state.push(newState);
    return newState;
  }

  public getState(id: string, groupId?: string): SkeletonState {

    let states: SkeletonState[] = [];

    states = groupId 
      ? this.state.filter(s => s.groupId === groupId)
      : this.state;

    let requestedState = states.find(s => s.id === id);

    if (!requestedState) {
      requestedState = this.addState(id, groupId)
    }

    return requestedState;
  }

  public removeState(id: string, groupId?: string): void {
    const toDelete: number[] = [];

    this.state.forEach((state, index) => {
      if (state.id === id && state.groupId === groupId) {
        state.destroy();
        toDelete.push(index);
      }
    });

    toDelete.forEach(index => this.state.splice(index));
  }

  public removeStateById(id: string): void {
    const toDelete: number[] = [];

    this.state.forEach((state, index) => {
      if (state.id === id) {
        state.destroy();
        toDelete.push(index);
      }
    });

    toDelete.forEach(index => this.state.splice(index));
  }

  public removeStatesByGroup(groupId: string): void {
    const toDelete: number[] = [];

    this.state.forEach((state, index) => {
      if (state.groupId === groupId) {
        state.destroy();
        toDelete.push(index);
      }
    });

    toDelete.forEach(index => this.state.splice(index));
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