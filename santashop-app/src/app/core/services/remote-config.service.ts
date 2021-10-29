import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig } from '@angular/fire/compat/remote-config';
import { debounceTime, shareReplay, startWith, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RemoteConfigService {

  // private readonly configValues = 
  //   this.remoteConfig.changes.pipe(
  //     filterFresh(900_000), // 15 minutes
  //     first(),
  //     map(i => i as Parameter),
  //     tap(v => console.log(v)),
  //     scanToObject({
  //       registrationEnabled: true,
  //       maintenanceModeEnabled: false
  //     }),
  //   );

  // public readonly registrationEnabled$ = this.configValues.pipe(
  //   map(param => param.registrationEnabled),
  //   tap(value => console.log('Registration Enabled', value)),
  //   shareReplay(1)
  // );

  public readonly registrationEnabled$ = 
    this.remoteConfig.booleans.registrationEnabled.pipe(
      startWith(true),
      debounceTime(500),
      tap(value => console.log('Registration Enabled', value)),
      shareReplay(1)
    );

  public readonly maintenanceModeEnabled$ =
    this.remoteConfig.booleans.maintenanceModeEnabled.pipe(
      startWith(false),
      debounceTime(500),
      tap(value => console.log('Maintenance Mode Enabled', value)),
      shareReplay(1)
    );

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig
  ) { }
}
