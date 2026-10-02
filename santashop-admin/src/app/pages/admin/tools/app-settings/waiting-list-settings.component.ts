import {
	ChangeDetectionStrategy,
	Component,
	inject,
	OnInit,
	signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
	IonButton,
	IonItem,
	IonToggle,
	IonSpinner,
} from '@ionic/angular/standalone';
import {
	defaultWaitingListSettings,
	type WaitingListSettingsResponse,
} from '@santashop/models';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { AppSettingsService } from '../../../../shared/services/app-settings.service';

@Component({
	selector: 'admin-waiting-list-settings',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		IonButton,
		IonItem,
		IonToggle,
		IonSpinner,
		AdminTextPipe,
	],
	template: `<section
		aria-labelledby="waiting-settings-heading"
		class="ion-padding"
	>
		<h2 id="waiting-settings-heading">
			{{ 'Waiting list controls' | adminText }}
		</h2>
		<p>
			{{ 'Joining and email delivery have separate controls.' | adminText }}
		</p>
		@if (busy()) {
			<ion-spinner [attr.aria-label]="'Loading' | adminText" />
		}
		@if (error()) {
			<p role="alert">{{ error() | adminText }}</p>
		}
		@if (saved()) {
			<p role="status">{{ 'Waiting list settings published.' | adminText }}</p>
		}
		@if (loaded()) {
			<form [formGroup]="form" (ngSubmit)="publish()">
				<ion-item
					><ion-toggle formControlName="joiningEnabled">{{
						'Allow customers to join the waiting list' | adminText
					}}</ion-toggle></ion-item
				>
				<ion-item
					><ion-toggle formControlName="emailSendingEnabled">{{
						'Allow waiting-list capacity emails' | adminText
					}}</ion-toggle></ion-item
				>
				<p>{{ 'Existing members can always leave the list.' | adminText }}</p>
				<ion-button type="submit" [disabled]="busy() || !form.dirty">{{
					'Publish waiting list settings' | adminText
				}}</ion-button>
			</form>
		}
		<ion-button fill="outline" [disabled]="busy()" (click)="reload()">{{
			'Reload waiting list settings' | adminText
		}}</ion-button>
	</section>`,
})
export class WaitingListSettingsComponent implements OnInit {
	private readonly service = inject(AppSettingsService);
	private readonly builder = inject(NonNullableFormBuilder);
	private etag = '';
	public readonly form = this.builder.group(defaultWaitingListSettings());
	public readonly busy = signal(false);
	public readonly loaded = signal(false);
	public readonly error = signal('');
	public readonly saved = signal(false);
	public ngOnInit(): void {
		void this.reload();
	}
	public async reload(): Promise<void> {
		if (this.busy()) return;
		this.busy.set(true);
		this.error.set('');
		this.saved.set(false);
		try {
			this.accept(await this.service.readWaitingList());
		} catch {
			this.error.set('Waiting list settings could not be loaded. Try again.');
		} finally {
			this.busy.set(false);
		}
	}
	public async publish(): Promise<void> {
		if (this.busy() || !this.form.dirty || !this.loaded()) return;
		this.busy.set(true);
		this.error.set('');
		this.saved.set(false);
		this.form.disable();
		try {
			this.accept(
				await this.service.publishWaitingList({
					settings: this.form.getRawValue(),
					expectedEtag: this.etag,
				}),
			);
			this.saved.set(true);
		} catch {
			this.error.set(
				'Publication was not confirmed. Your edits remain here. Reload before retrying.',
			);
		} finally {
			this.busy.set(false);
			this.form.enable();
		}
	}
	private accept(response: WaitingListSettingsResponse): void {
		this.form.reset(response.settings);
		this.etag = response.etag;
		this.loaded.set(true);
	}
}
