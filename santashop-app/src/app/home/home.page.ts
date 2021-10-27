import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { RemoteConfigService } from '../core/services/remote-config.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly $signupEnabled = 
    this.remoteConfigService.registrationEnabled$.pipe(
      takeUntil(this.destroy$),
      map(value => !value),
      shareReplay(1)
    );

  constructor(
    
    private readonly remoteConfigService: RemoteConfigService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }  
}
