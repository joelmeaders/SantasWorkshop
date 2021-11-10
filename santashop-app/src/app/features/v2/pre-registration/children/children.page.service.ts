import { Injectable, OnDestroy } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { IChild } from '@models/*';
import { Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay, take } from 'rxjs/operators';

@Injectable()
export class ChildrenPageService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly children$: Observable<IChild[] | undefined> =
    this.preRegistrationService.children$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  public readonly childCount$: Observable<number> =
    this.preRegistrationService.childCount$.pipe(
      takeUntil(this.destroy$),
      shareReplay(1)
    );

  constructor(
    private readonly preRegistrationService: PreRegistrationService,
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  public async removeChild(childToRemove: IChild): Promise<void> {

    const children = 
      await this.children$.pipe(take(1)).toPromise();

    const updatedChildren = children?.filter(
      child => child.id !== childToRemove.id);

    return this.updateRegistration(updatedChildren);
  }

  public async updateRegistration(children?: IChild[]) {

    const registration = 
      await this.preRegistrationService.userRegistration$.pipe(take(1)).toPromise();
    
    registration.children = children;
    
    // TODO: Error handling
    const storeRegistration = 
      this.preRegistrationService.saveRegistration(registration)
        .pipe(take(1)).toPromise();

    try {
      await storeRegistration;
    } 
    catch (error) 
    { 
      // TODO: Do something
    }
  }
}
