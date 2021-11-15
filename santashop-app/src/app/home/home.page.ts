import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { map, shareReplay, takeUntil } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { RemoteConfigService } from '../core/services/remote-config.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnDestroy {

  private readonly destroy$ = new Subject<void>();

  public readonly environmentName = `${environment.name}_${environment.label}`;
  public readonly environmentVersion = environment.version;

  public readonly $signupEnabled = 
    this.remoteConfigService.registrationEnabled$.pipe(
      takeUntil(this.destroy$),
      map(value => !value),
      shareReplay(1)
    );

  constructor(
    
    private readonly remoteConfigService: RemoteConfigService,
    private readonly toastController: ToastController
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }  

  async presentToast() {
    const toast = await this.toastController.create({
      message: 'Your settings have been saved.',
      duration: 2000,
      color: 'success',
      position: "middle",
    });
    toast.present();
  }
}
