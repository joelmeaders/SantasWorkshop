import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { SignUpPageService } from './sign-up.page.service';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.page.html',
  styleUrls: ['./sign-up.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SignUpPageService],
})
export class SignUpPage {
  public readonly form = this.viewService.form;

  @ViewChild('firstName') firstName?: HTMLIonInputElement;

  constructor(private readonly viewService: SignUpPageService) {}

  ionViewWillEnter() {
    setTimeout(() => this.firstName?.setFocus(), 300);
  }

  public async onCreateAccount(): Promise<void> {
    await this.viewService.onboardUser();
  }
    
}
