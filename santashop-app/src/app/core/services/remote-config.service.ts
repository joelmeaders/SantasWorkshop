import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig, budget } from '@angular/fire/compat/remote-config';
import { distinctUntilChanged, filter, last, map, publishReplay, refCount } from 'rxjs/operators';

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

  public readonly signupEnabled$ = this.valueFromConfig$('signupEnabled').pipe(
    map(param => param.asBoolean()),
    distinctUntilChanged(),
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig
  ) { }
}
