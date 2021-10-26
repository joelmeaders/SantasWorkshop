import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig, budget } from '@angular/fire/compat/remote-config';
import { distinctUntilChanged, filter, last, map, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RemoteConfigService {

  private readonly valueFromConfig$ = (value: string) => 
    this.remoteConfig.changes.pipe(
      filter((param) => param.key === value),
      budget(800),
      last()
    );

  public readonly registrationEnabled$ = this.valueFromConfig$('registrationEnabled').pipe(
    map(param => param.asBoolean()),
    distinctUntilChanged(),
    shareReplay(1)
  );

  public readonly maintenanceModeEnabled$ = this.valueFromConfig$('maintenanceModeEnabled').pipe(
    map(param => param.asBoolean()),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig
  ) { }
}
