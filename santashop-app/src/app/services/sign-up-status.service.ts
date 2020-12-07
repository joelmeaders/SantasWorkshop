import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig, budget } from '@angular/fire/remote-config';
import { Router, Event as NavigationEvent, NavigationEnd } from '@angular/router';
import { distinctUntilChanged, filter, map, publishReplay, refCount, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SignUpStatusService {

  private readonly _$valueFromConfig = this.remoteConfig.changes.pipe(
    filter(param => param.key === 'signupEnabled'),
    map(param => param.asBoolean()),
    budget(800),
  );

  public readonly $signupEnabled = this._$valueFromConfig.pipe(
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  public readonly navigationSub = this.router.events.pipe(
      filter((event: NavigationEvent) => event instanceof NavigationEnd),
      filter((event: NavigationEnd) => event.url !== '/registration-closed'),
      switchMap(() => this.$signupEnabled),
      filter((response: boolean) => !response),
    ).subscribe(value => {
      this.router.navigate(['/registration-closed']);
    });

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig,
    private readonly router: Router
  ) { }
}
