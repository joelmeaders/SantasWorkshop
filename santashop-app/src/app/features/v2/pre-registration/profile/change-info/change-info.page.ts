import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProfilePageService } from '../profile.page.service';

@Component({
	selector: 'app-change-info',
	templateUrl: './change-info.page.html',
	styleUrls: ['./change-info.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ProfilePageService],
})
export class ChangeInfoPage {
	public readonly form = this.viewService.profileForm;

	constructor(private readonly viewService: ProfilePageService) {}

	public updateProfile(): void {
		this.viewService.updatePublicProfile();
	}
}
