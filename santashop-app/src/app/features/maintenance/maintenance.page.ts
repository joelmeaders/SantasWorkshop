import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-maintenance',
  templateUrl: './maintenance.page.html',
  styleUrls: ['./maintenance.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaintenancePage implements OnInit {

  constructor(
    public readonly service: AppStateService,
    private readonly router: Router
  ) { }

  async ngOnInit() {
    const isMaintenanceModeEnabled = await this.service.isMaintenanceModeEnabled$.pipe(take(1)).toPromise();

    if (!isMaintenanceModeEnabled) {
      this.router.navigate(['/']);
    }
  }

}
