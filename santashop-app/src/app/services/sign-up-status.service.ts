import { Injectable } from '@angular/core';
import { AngularFireRemoteConfig, budget } from '@angular/fire/remote-config';
import { distinctUntilChanged, filter, map, publishReplay, refCount } from 'rxjs/operators';

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

  constructor(
    private readonly remoteConfig: AngularFireRemoteConfig
  ) { }
}
