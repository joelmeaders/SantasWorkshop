import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig, budget } from '@angular/fire/compat/remote-config';
import { shareReplay, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RemoteConfigService {

  public readonly registrationEnabled$ = 
    this.remoteConfig.booleans.registrationEnabled.pipe(
      tap(v => console.log('registrationEnabled', v)),
      budget(800),
      shareReplay(1)
    );

  public readonly maintenanceModeEnabled$ =
    this.remoteConfig.booleans.maintenanceModeEnabled.pipe(
      tap(v => console.log('maintenanceEnabled', v)),
      budget(800),
      shareReplay(1)
    );

  public readonly shopClosedWeather$ =
    this.remoteConfig.booleans.shopClosedWeather.pipe(
      tap(v => console.log('shopClosedWeather', v)),
      budget(800),
      shareReplay(1)
    );

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig
  ) { }
}
