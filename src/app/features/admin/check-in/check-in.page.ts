import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CheckInService } from '@app/core/services/check-in.service';

@Component({
  selector: 'app-check-in',
  templateUrl: './check-in.page.html',
  styleUrls: ['./check-in.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckInPage {

  constructor(
    private readonly checkInService: CheckInService
  ) { }

  

}
