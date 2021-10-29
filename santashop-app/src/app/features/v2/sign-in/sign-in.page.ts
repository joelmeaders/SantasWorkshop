import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { shareReplay } from 'rxjs/operators';
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

  @ViewChild('captchaRef') captchaRef: ReCaptchaV2.ReCaptcha | null = null;

  public readonly recaptchaValid$ = this.viewService.recaptchaValid$.asObservable().pipe(
    shareReplay(1)
  );

  constructor(
    private readonly viewService: SignInPageService
  ) { }

  public async onValidateRecaptcha($event: any) {
    await this.viewService.onValidateRecaptcha($event);
  }

  public async onSignIn(): Promise<void> {
    await this.viewService.signIn()
  }

}
