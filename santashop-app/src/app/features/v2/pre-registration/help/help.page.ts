import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '@core/*';

@Component({
  selector: 'app-help',
  templateUrl: './help.page.html',
  styleUrls: ['./help.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpPage {

  public readonly isRegistrationComplete$ = this.viewService.registrationComplete$;

  constructor(
    public readonly viewService: PreRegistrationService,
    ) { }
  }
  