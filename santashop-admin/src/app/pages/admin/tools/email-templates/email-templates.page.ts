import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import {
	IonBadge,
	IonCardHeader,
	IonContent,
	IonFab,
	IonFabButton,
	IonIcon,
	IonItem,
	IonLabel,
	IonList,
	IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import type { EmailTemplateSummary } from '@santashop/models';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { EmailTemplateService } from './email-template.service';

@Component({
	selector: 'admin-email-templates',
	templateUrl: './email-templates.page.html',
	styleUrls: ['./email-templates.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AdminTextPipe,
		HeaderComponent,
		IonBadge,
		IonCardHeader,
		IonContent,
		IonFab,
		IonFabButton,
		IonIcon,
		IonItem,
		IonLabel,
		IonList,
		IonNote,
	],
})
export class EmailTemplatesPage {
	private readonly emailTemplateService = inject(EmailTemplateService);
	private readonly router = inject(Router);

	public readonly templates = signal<EmailTemplateSummary[]>([]);
	public readonly isLoading = signal(true);

	constructor() {
		addIcons({ add });
	}

	public async ionViewWillEnter(): Promise<void> {
		await this.loadTemplates();
	}

	public async openTemplate(key: string): Promise<void> {
		await this.router.navigate(['/admin/email-templates', key]);
	}

	public async createTemplate(): Promise<void> {
		await this.router.navigate(['/admin/email-templates/create']);
	}

	public publishStateLabel(template: EmailTemplateSummary): string {
		return template.publishedRevisionId ? 'Published' : 'Draft only';
	}

	public deliveryProfileLabel(template: EmailTemplateSummary): string {
		if (template.deliveryProfile === 'registration-cancellation')
			return 'Registration cancellation';
		return template.deliveryProfile === 'event-reminder'
			? 'Event reminder'
			: 'Registration confirmation';
	}

	private async loadTemplates(): Promise<void> {
		this.isLoading.set(true);
		try {
			const templates =
				await this.emailTemplateService.listEmailTemplates();
			this.templates.set(templates);
		} finally {
			this.isLoading.set(false);
		}
	}
}
