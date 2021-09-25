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

  // TODO: Check for memory leaks using passthrough obs
  public readonly children$ = this.viewService.children$;
  public readonly childCount$ = this.viewService.childCount$;
  public readonly dateTimeSlot$ = this.viewService.dateTimeSlot$;

  constructor(
    private readonly viewService: SubmitPageService,
  ) { }

  public async submit(): Promise<void> {
    await this.viewService.submitRegistration();
  }
}
