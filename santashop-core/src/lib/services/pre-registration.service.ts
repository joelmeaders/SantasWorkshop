import { Injectable, OnDestroy } from '@angular/core';
import { DocumentReference } from '@angular/fire/compat/firestore';
import { Observable, Subject } from 'rxjs';
import { filter, map, mergeMap, shareReplay, switchMap, take, takeUntil } from 'rxjs/operators';
import { COLLECTION_SCHEMA } from '../helpers/schema.model';
import { IDateTimeSlot } from '../models/date-time-slot.model';
import { IRegistration } from '../models/registration.model';
import { AuthService } from './auth.service';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';
import { Timestamp } from '@firebase/firestore';
import { IChild } from '../models/child.model';

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
      map(registration => this.isRegistrationComplete(registration)),
      shareReplay(1)
    );

  public readonly children$ = this.userRegistration$.pipe(
    takeUntil(this.destroy$),
    map(data => {
      data.children?.forEach(child => {
        child.dateOfBirth = (<any>child.dateOfBirth as Timestamp).toDate();
      })
      return data;
    }),
      map(registration => registration.children as IChild[] ?? new Array<IChild>()),
      shareReplay(1)
  );

  public readonly childCount$ = 
    this.userRegistration$.pipe(
      takeUntil(this.destroy$),
      map(registration => !!registration?.children ? registration.children.length : 0),
      shareReplay(1)
    );

  public readonly dateTimeSlot$: Observable<IDateTimeSlot | undefined> =
    this.userRegistration$.pipe(
      takeUntil(this.destroy$),
      map(registration => registration?.dateTimeSlot as IDateTimeSlot),
      // filter(registration => !!registration?.dateTime),
      // TODO: Make this map a shared reusable method
      map(data => {
        if (data) {
          data.dateTime = (<any>data.dateTime as Timestamp).toDate()
          return data;
        }
        return data;
      }),
      shareReplay(1)
    );

  constructor(
    private readonly fireRepo: FireRepoLite,
    private readonly authService: AuthService
  ) { }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // TODO: Convert to function
  public saveRegistration(registration: IRegistration): Observable<DocumentReference> {
    
    this.validateRegistration(registration);

    return this.authService.uid$.pipe(take(1)).pipe(
      take(1),
      switchMap(uid => this.registrationCollection().update(uid, registration, false))
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
}
