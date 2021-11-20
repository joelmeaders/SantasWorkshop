import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SubmitPageService } from './submit.page.service';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.page.html',
  styleUrls: ['./submit.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ SubmitPageService ]
})
export class SubmitPage {

  constructor(
    public readonly viewService: SubmitPageService
  ) { }

  public async submit(): Promise<void> {
    await this.viewService.submitRegistration();
  }
}
