import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-registration-closed',
  templateUrl: './registration-closed.page.html',
  styleUrls: ['./registration-closed.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistrationClosedPage implements OnInit {

  constructor(
    public readonly service: AppStateService,
    private readonly router: Router
  ) { }

  async ngOnInit() {
    const isRegistrationEnabled = await this.service.isRegistrationEnabled$.pipe(take(1)).toPromise();

    if (isRegistrationEnabled) {
      this.router.navigate(['/']);
    }
  }

}
