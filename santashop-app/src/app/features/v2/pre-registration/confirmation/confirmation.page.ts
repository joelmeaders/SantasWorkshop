import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '@core/*';

@Component({
  selector: 'app-confirmation',
  templateUrl: './confirmation.page.html',
  styleUrls: ['./confirmation.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationPage {

  constructor(
    public readonly viewService: PreRegistrationService
  ) { }

}
