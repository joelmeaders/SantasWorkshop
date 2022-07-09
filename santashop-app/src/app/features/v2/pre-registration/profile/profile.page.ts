import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '../../../../core';
import { ProfilePageService } from './profile.page.service';

@Component({
	selector: 'app-profile',
	templateUrl: './profile.page.html',
	styleUrls: ['./profile.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ProfilePageService],
})
export class ProfilePage {
	public readonly profileForm = this.viewService.profileForm;

	public readonly changeEmailForm = this.viewService.changeEmailForm;

	public readonly changePasswordForm = this.viewService.changePasswordForm;

	public readonly userProfile$ = this.viewService.userProfile$;

	public readonly isRegistrationComplete$ =
		this.preregistrationService.registrationComplete$;

	public readonly updateProfile = (): Promise<void> =>
		this.viewService.updatePublicProfile();

	public readonly changeEmailAddress = (): Promise<void> =>
		this.viewService.changeEmailAddress();

	public readonly changePassword = (): Promise<void> =>
		this.viewService.changePassword();

	constructor(
		private readonly viewService: ProfilePageService,
		private readonly preregistrationService: PreRegistrationService
	) {
		console.log('view', viewService);
		console.log('registration', preregistrationService);
	}
}
