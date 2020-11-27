import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { MaintenanceService } from '../../services/maintenance.service';

@Component({
  selector: 'app-maintenance',
  templateUrl: './maintenance.page.html',
  styleUrls: ['./maintenance.page.scss'],
})
export class MaintenancePage implements OnInit {

  constructor(
    public readonly service: MaintenanceService,
    private readonly router: Router
  ) { }

  async ngOnInit() {
    const isMaintenance = await this.service.$isMaintenance.pipe(take(1)).toPromise();

    if (!isMaintenance) {
      this.router.navigate(['/']);
    }
  }

}
