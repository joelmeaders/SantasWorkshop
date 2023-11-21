import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core';
import { environment } from '../../../environments/environment';

@Component({
	selector: 'admin-sign-in',
	templateUrl: './sign-in.page.html',
	styleUrls: ['./sign-in.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage {

	public readonly environmentName = `${environment.name}_${environment.label}`;
	public readonly environmentVersion = environment.version;

	protected readonly form = new UntypedFormGroup({
		emailAddress: new UntypedFormControl(undefined, [
			Validators.email,
			Validators.required,
		]),
		password: new UntypedFormControl(undefined, [Validators.required]),
	});

	constructor(
		private readonly authService: AuthService,
		private readonly router: Router,
	) {}

	public async login(): Promise<void> {
		try {
			await this.authService
			.login({ ...this.form.value })
			.then(() => this.router.navigate(['/admin']));
		} catch (error) {
			console.error(error);
		}
	}
}
