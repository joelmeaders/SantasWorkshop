import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '@core/*';
import { ProfilePageService } from './profile.page.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ ProfilePageService ]
})
export class ProfilePage {

  public readonly profileForm = this.viewService.profileForm;
  public readonly changeEmailForm = this.viewService.changeEmailForm;
  public readonly changePasswordForm = this.viewService.changePasswordForm;

  public readonly publicProfile$ = this.viewService.userProfile$;
  public readonly isRegistrationComplete$ = this.preregistrationService.registrationComplete$;


  constructor(
    private readonly viewService: ProfilePageService,
    public readonly preregistrationService: PreRegistrationService
    ) { }

  public async updateProfile(): Promise<void> {
    await this.viewService.updatePublicProfile();
  }

  public async changeEmailAddress(): Promise<void> {
    await this.viewService.changeEmailAddress();
  }

  public async changePassword(): Promise<void> {
    await this.viewService.changePassword();
  }
}
