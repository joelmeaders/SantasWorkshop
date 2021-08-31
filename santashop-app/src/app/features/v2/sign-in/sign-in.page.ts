import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SignInPageService } from './sign-in.page.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.page.html',
  styleUrls: ['./sign-in.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ SignInPageService ]
})
export class SignInPage {

  public readonly form = this.viewService.form;

  constructor(
    private readonly viewService: SignInPageService
  ) { }

  public async onSignIn(): Promise<void> {
    await this.viewService.signIn()
  }

}
