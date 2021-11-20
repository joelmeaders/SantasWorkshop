import { Inject, Injectable, OnDestroy } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ErrorHandlerService } from '@core/*';
import { AlertController, LoadingController } from '@ionic/angular';
import { COLLECTION_SCHEMA, IError, IUser } from '@models/*';
import { of, Subject } from 'rxjs';
import { filter, map, pluck, switchMap, take, takeUntil } from 'rxjs/operators';
import { PROFILE_VERSION } from '../tokens';
import { AuthService } from './auth.service';
import { FireRepoLite } from './fire-repo-lite.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileMigrationService implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  private readonly getCurrentUserDocument$ = (uid: string) =>
    this.fireRepo.collection(COLLECTION_SCHEMA.users).read<IUser>(uid, 'uid').pipe(
      takeUntil(this.destroy$)
    );

  private readonly currentUserDocument$ = 
    this.authService.uid$.pipe(
      takeUntil(this.destroy$),
      switchMap(uid => this.getCurrentUserDocument$(uid)),
    );

  private readonly isProfileVersionCurrent$ = 
    this.currentUserDocument$.pipe(
      takeUntil(this.destroy$),
      pluck('version'),
      map((version: number | undefined) => version === this.latestProfileVersion),
    );

  public readonly migrateProfileSubscription =
    this.isProfileVersionCurrent$.pipe(
      takeUntil(this.destroy$),
      filter(isCurrent => !isCurrent),
      switchMap(() => this.currentUserDocument$),
      switchMap(user => of(this.updateProfile(user.version)))
    ).subscribe(); 

  constructor(
    private readonly authService: AuthService,
    private readonly fireRepo: FireRepoLite,
    @Inject(PROFILE_VERSION) public readonly latestProfileVersion: number,
    private readonly loadingController: LoadingController,
    private readonly errorHandler: ErrorHandlerService,
    private readonly afFunctions: AngularFireFunctions,
    private readonly alertController: AlertController
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async updateProfile(version: number | undefined) {

    const loader = await this.loadingController.create(
      { message: 'Migrating data...' });

    await loader.present();

    try {
      // Upgrade logic here
      if (version === undefined) {
        await this.update_V0_To_V1().pipe(take(1)).toPromise().then(v => console.log(v));
        version = 1;
      }
      // Append later versions as needed
    } 
    catch(error) {
      const account = await this.currentUserDocument$.pipe(take(1)).toPromise();
      await loader.dismiss();

      const alert = await this.alertController.create({
        header: 'ACCOUNT MIGRATION ERROR',
        subHeader: account.emailAddress,
        message: 'Please contact us from our website to resolve this problem.'
      });

      await alert.present();
      await alert.onDidDismiss();

      this.errorHandler.handleError(error as IError, false);
    }
    finally {
      await loader.dismiss();
    }

  }

  private update_V0_To_V1() {
    return this.afFunctions.httpsCallable('migrateProfile_V0_To_V1')({});
  }
}
