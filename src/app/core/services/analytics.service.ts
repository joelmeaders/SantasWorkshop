import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { Subject, BehaviorSubject, of } from 'rxjs';
import { AuthService } from './auth.service';
import { takeUntil, publishReplay, refCount, switchMap, map } from 'rxjs/operators';
import { UserProfileService } from '@app/core/services/http/user-profile.service';
import { BaseEntity } from '@app/core/models/base/base-entity';

export class LocalPreferences extends BaseEntity {
  id: 'analytics';
  analyticsDisabled: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService implements OnDestroy {

  constructor(
    private readonly angularFireAnalytics: AngularFireAnalytics,
    // private readonly localStorage: LocalCacheService,
    private readonly authService: AuthService,
    private readonly userProfileService: UserProfileService
  ) {
    
  }

  private readonly $destroy = new Subject<void>();
  private readonly $enabled = new BehaviorSubject<boolean>(true);

  // private readonly $localPreference = this.localStorage.readItem<LocalPreferences>('LocalPreferences', 'analytics').pipe(
  //   takeUntil(this.$destroy),
  //   publishReplay(1),
  //   refCount()
  // );

  private readonly $profilePreference = this.authService.$userProfile.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  // private readonly initSubscription = this.$profilePreference.pipe(
  //   takeUntil(this.$destroy),
  //   switchMap(profilePref => profilePref ? of(profilePref.additionalInfo) : this.$localPreference),
  //   map(res => res && res.analyticsDisabled ? !!res.analyticsDisabled : true)
  // ).subscribe(boolResponse => {
  //   this.angularFireAnalytics.setAnalyticsCollectionEnabled(boolResponse);
  // });

  public ngOnDestroy() {
    this.$destroy.next();
  }
}
