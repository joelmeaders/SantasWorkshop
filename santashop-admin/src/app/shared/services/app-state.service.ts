import { inject, Injectable, OnDestroy } from '@angular/core';
import { FireRepoLite } from '@santashop/core';
import { Observable, takeUntil, distinctUntilChanged, shareReplay, Subject, map, startWith, catchError, of } from 'rxjs';
import { PublicParameters, COLLECTION_SCHEMA } from '@santashop/models';

@Injectable({
  providedIn: 'root'
})
export class AppStateService implements OnDestroy {
  private readonly httpService = inject(FireRepoLite);

	private readonly destroy$ = new Subject<void>();

  private readonly parameters$: Observable<PublicParameters> = this.httpService
		.collection<PublicParameters>(COLLECTION_SCHEMA.parameters)
		.read('public')
		.pipe(
			takeUntil(this.destroy$),
			distinctUntilChanged((prev, curr) => {
				return JSON.stringify(prev) === JSON.stringify(curr);
			}),
			shareReplay(1),
		);

  public readonly preRegistrationEnabled$: Observable<boolean> = this.parameters$.pipe(
    takeUntil(this.destroy$),
    map((value) => value.admin.preRegistrationEnabled),
    startWith(false),
    catchError(() => of(false))
  );

  public readonly onsiteRegistrationEnabled$: Observable<boolean> = this.parameters$.pipe(
    takeUntil(this.destroy$),
    map((value) => value.admin.onsiteRegistrationEnabled),
    startWith(false),
    catchError(() => of(false))
  );

  public readonly checkinEnabled$: Observable<boolean> = this.parameters$.pipe(
    takeUntil(this.destroy$),
    map((value) => value.admin.checkinEnabled),
    startWith(false),
    catchError(() => of(false))
  );

    public ngOnDestroy(): void {
      throw new Error('Method not implemented.');
    }
}
