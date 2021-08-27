import { Injectable, OnDestroy } from '@angular/core';
import { DocumentReference } from '@angular/fire/compat/firestore';
import { AuthService, COLLECTION_SCHEMA, FireRepoLite, IFireRepoCollection, IRegistration } from '@core/*';
import { Observable, Subject } from 'rxjs';
import { filter, map, mergeMap, shareReplay, switchMap, take, takeUntil } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PreRegistrationService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly userRegistration$ =
    this.authService.uid$.pipe(
      takeUntil(this.destroy$),
      filter(value => !!value),
      mergeMap(uid => this.userRegistration(uid)),
      shareReplay(1)
    ); 

  public readonly registrationComplete$ =
    this.userRegistration$.pipe(
      takeUntil(this.destroy$),
      map(registration => this.isRegistrationComplete(registration))
    )

  constructor(
    private readonly fireRepo: FireRepoLite,
    private readonly authService: AuthService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public saveRegistration(registration: IRegistration): Observable<DocumentReference> {
    
    this.validateRegistration(registration);

    return this.authService.uid$.pipe(take(1)).pipe(
      take(1),
      switchMap(uid => this.registrationCollection().update(uid, registration, true))
    );
  }

  private registrationCollection(): IFireRepoCollection {
    return this.fireRepo.collection(COLLECTION_SCHEMA.registrations);
  }

  private userRegistration(uid: string): Observable<IRegistration> {
    return this.registrationCollection().read<IRegistration>(uid, 'uid');
  }

  // TODO: This method
  private isRegistrationComplete(registration: IRegistration): boolean {
    return !!registration;
  }

  // TODO: This method
  private validateRegistration(registration: IRegistration): void {
    registration = registration;
  }

  // TODO: This method
  public friendlyDateTime(dateTime: Date) {
    return `TODO: Formatted Date/Time ${dateTime}`;
  }
}
