import { Injectable } from '@angular/core';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { RemoteConfig, getAllChanges } from '@angular/fire/remote-config';
import { traceUntilFirst } from '@angular/fire/performance';

@Injectable({
  providedIn: 'root',
})
export class RemoteConfigService {

  public readonly config$ = getAllChanges(this.remoteConfig).pipe(
    traceUntilFirst('remote-config'),
    shareReplay(1)
  );

  public readonly registrationEnabled$ =
    this.config$.pipe(
      map(param => param['registrationEnabled'].asBoolean()),
      distinctUntilChanged(),
      shareReplay(1)
    );

  public readonly maintenanceModeEnabled$ =
    this.config$.pipe(
      map(param => param['maintenanceModeEnabled'].asBoolean()),
      distinctUntilChanged(),
      shareReplay(1)
    );

  public readonly shopClosedWeather$ =
    this.config$.pipe(
      map(param => param['shopClosedWeather'].asBoolean()),
      distinctUntilChanged(),
      shareReplay(1)
    );

  constructor(
    private readonly remoteConfig: RemoteConfig
  ) { }
}
