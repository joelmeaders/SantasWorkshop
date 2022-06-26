import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProfilePageService } from '../profile.page.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProfilePageService],
})
export class ChangePasswordPage {
  public readonly form = this.viewService.changePasswordForm;

  constructor(private readonly viewService: ProfilePageService) {}

  public changePassword() {
    this.viewService.changePassword();
  }
}
