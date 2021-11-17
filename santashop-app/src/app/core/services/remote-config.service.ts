import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig } from '@angular/fire/compat/remote-config';
import { distinctUntilChanged, filter, map, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RemoteConfigService {

  public readonly config$ = this.remoteConfig.changes.pipe(
    shareReplay(1)
  );

  public readonly registrationEnabled$ =
    this.config$.pipe(
      filter(param => param.key === 'registrationEnabled'),
      map(param => param.asBoolean()),
      distinctUntilChanged(),
      shareReplay(1)
    );

  public readonly maintenanceModeEnabled$ =
    this.config$.pipe(
      filter(param => param.key === 'maintenanceModeEnabled'),
      map(param => param.asBoolean()),
      distinctUntilChanged(),
      shareReplay(1)
    );

  public readonly shopClosedWeather$ =
    this.config$.pipe(
      filter(param => param.key === 'shopClosedWeather'),
      map(param => param.asBoolean()),
      distinctUntilChanged(),
      shareReplay(1)
    );

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig
  ) { }
}
