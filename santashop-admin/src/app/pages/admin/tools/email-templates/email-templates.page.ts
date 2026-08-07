import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	IonBadge,
	IonButton,
	IonButtons,
	IonCardHeader,
	IonContent,
	IonFab,
	IonFabButton,
	IonIcon,
	IonItem,
	IonLabel,
	IonList,
	IonNote,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, createOutline } from 'ionicons/icons';
import type { EmailTemplateSummary } from '@santashop/models';
import { BehaviorSubject } from 'rxjs';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { EmailTemplateService } from './email-template.service';

@Component({
	selector: 'admin-email-templates',
	templateUrl: './email-templates.page.html',
	styleUrls: ['./email-templates.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AsyncPipe,
		HeaderComponent,
		IonBadge,
		IonButton,
		IonButtons,
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

	private readonly templatesSubject = new BehaviorSubject<EmailTemplateSummary[]>([]);
	public readonly templates$ = this.templatesSubject.asObservable();

	private readonly loadingSubject = new BehaviorSubject<boolean>(true);
	public readonly isLoading$ = this.loadingSubject.asObservable();

	constructor() {
		addIcons({ add, createOutline });
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
		return template.deliveryProfile === 'event-reminder'
			? 'Event reminder'
			: 'Registration confirmation';
	}

	private async loadTemplates(): Promise<void> {
		this.loadingSubject.next(true);
		try {
			const templates = await this.emailTemplateService.listEmailTemplates();
			this.templatesSubject.next(templates);
		} finally {
			this.loadingSubject.next(false);
		}
	}
}
