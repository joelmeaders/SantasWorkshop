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
	IonContent,
	IonInput,
	IonItem,
	IonList,
	IonListHeader,
	IonSpinner,
	IonTextarea,
	IonToggle,
} from '@ionic/angular/standalone';
import {
	createDefaultPublicParameters,
	parsePublicParameters,
	PublicParametersSettingsResponse,
} from '@santashop/models';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { AppSettingsService } from '../../../../shared/services/app-settings.service';

@Component({
	selector: 'admin-app-settings',
	templateUrl: './app-settings.page.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		HeaderComponent,
		IonButton,
		IonContent,
		IonInput,
		IonItem,
		IonList,
		IonListHeader,
		IonSpinner,
		IonTextarea,
		IonToggle,
	],
})
export class AppSettingsPage implements OnInit {
	private readonly service = inject(AppSettingsService);
	private readonly builder = inject(NonNullableFormBuilder);
	private readonly defaults = createDefaultPublicParameters();
	private etag = '';
	public readonly busy = signal(false);
	public readonly loaded = signal(false);
	public readonly error = signal('');
	public readonly status = signal('');
	public readonly version = signal('');
	public readonly form = this.builder.group({
		registrationEnabled: this.defaults.registrationEnabled,
		maintenanceModeEnabled: this.defaults.maintenanceModeEnabled,
		weatherModeEnabled: this.defaults.weatherModeEnabled,
		createAccountEnabled: this.defaults.createAccountEnabled,
		messageEn: this.defaults.messageEn,
		messageEs: this.defaults.messageEs,
		admin: this.builder.group(this.defaults.admin),
		globalAlert: this.builder.group(this.defaults.globalAlert),
	});
	public ngOnInit(): void {
		void this.reload();
	}
	public async reload(): Promise<void> {
		if (this.busy()) return;
		this.begin();
		try {
			this.accept(await this.service.read());
		} catch (error: unknown) {
			this.showError(error);
		} finally {
			this.end();
		}
	}
	public async publish(): Promise<void> {
		if (
			this.busy() ||
			!this.loaded() ||
			!this.form.dirty ||
			this.form.invalid
		)
			return;
		this.begin();
		try {
			const settings = parsePublicParameters(this.form.getRawValue());
			const result = await this.service.publish({
				settings,
				expectedEtag: this.etag,
			});
			this.accept(result);
			this.status.set(`Published version ${result.version}.`);
		} catch (error: unknown) {
			this.showError(error);
		} finally {
			this.end();
		}
	}
	private begin(): void {
		this.busy.set(true);
		this.error.set('');
		this.status.set('');
		this.form.disable();
	}
	private end(): void {
		this.busy.set(false);
		this.form.enable();
	}
	private accept(result: PublicParametersSettingsResponse): void {
		const settings = parsePublicParameters(result.settings);
		this.form.reset(settings);
		this.etag = result.etag;
		this.version.set(result.version);
		this.loaded.set(true);
	}
	private showError(error: unknown): void {
		const code = (error as { code?: string } | null)?.code;
		this.error.set(
			code === 'functions/aborted' || code === 'aborted'
				? 'Settings changed since you loaded them. Your edits remain here. Copy your edits before selecting Discard edits and reload.'
				: error instanceof Error
					? error.message
					: 'Settings could not be saved or loaded. Your edits remain here.',
		);
	}
}
