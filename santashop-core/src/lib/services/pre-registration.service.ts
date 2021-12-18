import { Injectable, OnDestroy } from '@angular/core';
import { DocumentReference } from '@angular/fire/compat/firestore';
import { Observable, Subject } from 'rxjs';
import {
  filter,
  map,
  mergeMap,
  shareReplay,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { FireRepoLite, IFireRepoCollection } from './fire-repo-lite.service';
import { Timestamp } from '@firebase/firestore';
import { IDateTimeSlot, IRegistration, IChild, COLLECTION_SCHEMA } from '@models/*';
import { ref, Storage, getDownloadURL } from '@angular/fire/storage';
import { Functions } from '@angular/fire/functions';
import { httpsCallable } from 'rxfire/functions';

@Injectable({
  providedIn: 'root',
})
export class PreRegistrationService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public readonly userRegistration$ = this.authService.uid$.pipe(
    takeUntil(this.destroy$),
    filter((value) => !!value),
    mergeMap((uid) => this.userRegistration(uid)),
    shareReplay(1)
  );

  public readonly registrationComplete$ = this.userRegistration$.pipe(
    takeUntil(this.destroy$),
    mergeMap(() => this.isRegistrationComplete()),
    shareReplay(1)
  );

  public readonly registrationSubmitted$ = this.userRegistration$.pipe(
    takeUntil(this.destroy$),
    map((registration) => !!registration.registrationSubmittedOn),
    shareReplay(1)
  );

  public readonly children$ = this.userRegistration$.pipe(
    takeUntil(this.destroy$),
    map((registration) => this.getChildren(registration)),
    shareReplay(1)
  );

  public readonly childCount$ = this.userRegistration$.pipe(
    takeUntil(this.destroy$),
    map((registration) => registration?.children?.length ?? 0
    ),
    shareReplay(1)
  );

  public readonly noErrorsInChildren$ = this.children$.pipe(
    takeUntil(this.destroy$),
    map(children => children.filter(c => !!c.error)),
    map(errors => errors.length === 0),
    shareReplay(1)
  );

  public readonly dateTimeSlot$: Observable<IDateTimeSlot | undefined> =
    this.userRegistration$.pipe(
      takeUntil(this.destroy$),
      map((registration) => this.getDateTimeSlot(registration)),
      shareReplay(1)
    );

  public qrCode$ = this.userRegistration$.pipe(
    takeUntil(this.destroy$),
    filter((registration) => !!registration?.uid),
    map(registration => ref(this.afStorage, `registrations/${registration.uid}.png`)),
    mergeMap((storageRef) => getDownloadURL(storageRef)),
    shareReplay(1)
  );

  constructor(
    private readonly fireRepo: FireRepoLite,
    private readonly authService: AuthService,
    private readonly afStorage: Storage,
    private readonly afFunctions: Functions
  ) {}

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // TODO: Convert to function
  public saveRegistration(
    registration: IRegistration
  ): Observable<DocumentReference> {
    this.validateRegistration(registration);

    return this.authService.uid$.pipe(take(1)).pipe(
      take(1),
      switchMap((uid) =>
        this.registrationCollection().update(uid, registration, false)
      )
    );
  }

  public undoRegistration() {
    const accountStatusFunction = 
      httpsCallable<any, boolean>(this.afFunctions, 'undoRegistration');
    return accountStatusFunction({});
  }

  private registrationCollection(): IFireRepoCollection {
    return this.fireRepo.collection(COLLECTION_SCHEMA.registrations);
  }

  private userRegistration(uid: string): Observable<IRegistration> {
    return this.registrationCollection().read<IRegistration>(uid, 'uid');
  }

  private async isRegistrationComplete(): Promise<boolean> {
    const hasChildren = !!(await this.childCount$.pipe(take(1)).toPromise());
    const hasDateTime = !!(await this.dateTimeSlot$.pipe(take(1)).toPromise());
    const isSubmitted = await this.registrationSubmitted$
      .pipe(take(1))
      .toPromise();
    return !!hasChildren && !!hasDateTime && !!isSubmitted;
  }

  // TODO: Make cloud function to handle this
  private validateRegistration(registration: IRegistration): void {
    registration = registration;
  }

  private getDateTimeSlot(
    registration: IRegistration
  ): IDateTimeSlot | undefined {
    const slot = registration?.dateTimeSlot as IDateTimeSlot;

    // Convert the timestamp to a date. Firebase (or angularfire) seems to be
    // setting all dates to timestamps in the database now.
    if (slot) {
      slot.dateTime = ((<any>slot.dateTime) as Timestamp).toDate();
      return slot;
    }

    return slot;
  }

  private getChildren(registration: IRegistration): IChild[] {
    registration.children?.forEach((child) => {
      child.dateOfBirth = ((<any>child.dateOfBirth) as Timestamp).toDate();
    });

    return (registration.children as IChild[]) ?? new Array<IChild>();
  }
}
