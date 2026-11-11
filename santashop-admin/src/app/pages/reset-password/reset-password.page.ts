import {
	afterNextRender,
	Injector,
	ChangeDetectionStrategy,
	Component,
	ViewChild,
	inject,
	signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
	IonButton,
	IonCard,
	IonCardContent,
	IonCardHeader,
	IonCardTitle,
	IonContent,
	IonInput,
} from '@ionic/angular/standalone';
import { AuthService } from '@santashop/core/admin';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { AdminTextPipe } from '../../shared/preferences/admin-text.pipe';

@Component({
	selector: 'admin-reset-password',
	templateUrl: './reset-password.page.html',
	styleUrl: './reset-password.page.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		RouterLink,
		AdminTextPipe,
		HeaderComponent,
		IonButton,
		IonCard,
		IonCardContent,
		IonCardHeader,
		IonCardTitle,
		IonContent,
		IonInput,
	],
})
export class ResetPasswordPage {
	private readonly auth = inject(AuthService);
	private readonly injector = inject(Injector);
	@ViewChild('emailInput') private readonly emailInput?: IonInput;
	public readonly email = new FormControl('', {
		nonNullable: true,
		validators: [Validators.required, Validators.email],
	});
	public readonly pending = signal(false);
	public readonly accepted = signal(false);
	public readonly failed = signal(false);

	public changeEmail(): void {
		this.email.reset();
		this.accepted.set(false);
		this.failed.set(false);
		afterNextRender(
			() => {
				void this.emailInput?.setFocus();
			},
			{ injector: this.injector },
		);
	}

	public submitFromEmail(event: Event): void {
		const key = event as KeyboardEvent;
		key.preventDefault();
		if (key.isComposing || key.keyCode === 229) return;
		(event.target as HTMLElement).closest('form')?.requestSubmit();
	}

	public async requestReset(): Promise<void> {
		if (this.pending() || this.accepted()) return;
		this.email.setValue(this.email.value.trim());
		this.email.markAsTouched();
		if (this.email.invalid) {
			await this.emailInput?.setFocus();
			return;
		}
		this.pending.set(true);
		this.failed.set(false);
		try {
			// Shared recovery endpoint preserves rate limiting and account privacy.
			await this.auth.resetPassword(this.email.value);
			this.accepted.set(true);
		} catch {
			// Never display provider messages or reveal whether this email has an account.
			this.failed.set(true);
		} finally {
			this.pending.set(false);
		}
	}
}
