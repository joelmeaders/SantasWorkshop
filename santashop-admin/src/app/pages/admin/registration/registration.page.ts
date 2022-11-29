import { Component, OnInit } from '@angular/core';
import { AuthService } from '@core/*';

@Component({
	selector: 'admin-registration',
	templateUrl: './registration.page.html',
	styleUrls: ['./registration.page.scss'],
})
export class RegistrationPage implements OnInit {
	constructor(private readonly auth: AuthService) {}

	public async ngOnInit(): Promise<void> {
		const t = await this.auth.getCurrentUserToken();
		console.log(t);
	}
}
