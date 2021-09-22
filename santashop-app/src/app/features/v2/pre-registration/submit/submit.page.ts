import { ChangeDetectionStrategy, Component } from '@angular/core';
// import { Router } from '@angular/router';
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
    // private readonly viewService: SubmitPageService,
    // private readonly router: Router
  ) { }

  // public async submit(): Promise<void> {

  // }
}
