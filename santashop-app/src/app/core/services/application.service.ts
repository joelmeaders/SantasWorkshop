import { Injectable, inject } from '@angular/core';
import { ProfileService } from './profile.service';
import { AuthService } from '../../../../../santashop-core/src';

@Injectable({
	providedIn: 'root',
})
export class ApplicationService {
	private readonly authService = inject(AuthService);

	private readonly profileService = inject(ProfileService);
}
