import { WaitingListEmailPreviewComponent } from './waiting-list-email-preview.component';
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	OnDestroy,
	OnInit,
	signal,
	viewChild,
} from '@angular/core';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';
import type {
	StartWaitingListCampaignRequest,
	WaitingListCampaign,
	WaitingListCampaignPreview,
} from '@santashop/models';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { WaitingListCampaignService } from './waiting-list-campaign.service';

@Component({
	selector: 'admin-waiting-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		WaitingListEmailPreviewComponent,
		IonButton,
		IonContent,
		IonSpinner,
		AdminTextPipe,
		HeaderComponent,
	],
	templateUrl: './waiting-list.page.html',
	styleUrls: ['./waiting-list.page.scss'],
})
export class WaitingListPage implements OnInit, OnDestroy {
	private readonly service = inject(WaitingListCampaignService);
	private readonly content = viewChild(IonContent);
	private timer?: ReturnType<typeof setTimeout>;
	private destroyed = false;
	private startRequest?: StartWaitingListCampaignRequest;
	public readonly preview = signal<WaitingListCampaignPreview | undefined>(
		undefined,
	);
	public readonly campaigns = signal<WaitingListCampaign[]>([]);
	public readonly selected = signal<WaitingListCampaign | undefined>(undefined);
	public readonly loading = signal(false);
	public readonly busy = signal(false);
	public readonly error = signal('');
	public readonly confirmed = signal(false);
	public ngOnInit(): void {
		void this.reload();
	}
	public ngOnDestroy(): void {
		this.destroyed = true;
		clearTimeout(this.timer);
	}
	public async reload(): Promise<void> {
		if (this.loading() || this.busy()) return;
		this.loading.set(true);
		this.error.set('');
		this.confirmed.set(false);
		this.startRequest = undefined;
		try {
			const [preview, campaigns] = await Promise.all([
				this.service.preview(),
				this.service.list(),
			]);
			this.preview.set(preview);
			this.campaigns.set(campaigns);
			const active = campaigns.find(
				(campaign) => campaign.status !== 'completed',
			);
			if (active) {
				this.selected.set(active);
				this.scheduleRefresh();
			}
		} catch {
			this.error.set('Waiting list could not be loaded. Try again.');
		} finally {
			this.loading.set(false);
		}
	}
	public async send(): Promise<void> {
		const preview = this.preview();
		if (!preview?.canSend || !this.confirmed() || this.busy()) return;
		const en = preview.emails.find((email) => email.language === 'en');
		const es = preview.emails.find((email) => email.language === 'es');
		if (!en || !es) return;
		this.startRequest ??= {
			mutationId: crypto.randomUUID(),
			revisions: {
				en: { templateKey: en.templateKey, revisionId: en.revisionId },
				es: { templateKey: es.templateKey, revisionId: es.revisionId },
			},
		};
		this.busy.set(true);
		this.error.set('');
		try {
			this.selected.set(await this.service.start(this.startRequest));
			void this.content()?.scrollToTop(200);
			this.confirmed.set(false);
			this.scheduleRefresh();
		} catch {
			this.error.set(
				'The campaign could not start. Check its status before sending again.',
			);
		} finally {
			this.busy.set(false);
		}
	}
	public async resume(): Promise<void> {
		const campaign = this.selected();
		if (!campaign || this.busy()) return;
		this.busy.set(true);
		this.error.set('');
		try {
			this.selected.set(await this.service.resume(campaign.id));
			void this.content()?.scrollToTop(200);
			this.scheduleRefresh();
		} catch {
			this.error.set(
				'The campaign could not resume. Check email settings and try again.',
			);
		} finally {
			this.busy.set(false);
		}
	}
	public select(campaign: WaitingListCampaign): void {
		this.selected.set(campaign);
		void this.content()?.scrollToTop(200);
		this.scheduleRefresh();
	}
	public canResume(campaign: WaitingListCampaign): boolean {
		return (
			campaign.status === 'paused' ||
			campaign.status === 'failed' ||
			(campaign.status !== 'completed' &&
				Date.now() - Date.parse(campaign.updatedAt) > 10 * 60_000)
		);
	}
	private scheduleRefresh(): void {
		clearTimeout(this.timer);
		const campaign = this.selected();
		if (
			this.destroyed ||
			!campaign ||
			!['queued', 'running'].includes(campaign.status)
		)
			return;
		this.timer = setTimeout(() => {
			void this.refreshStatus(campaign.id);
		}, 5000);
	}
	private async refreshStatus(id: string): Promise<void> {
		try {
			const campaign = await this.service.read(id);
			if (!this.destroyed && this.selected()?.id === id)
				this.selected.set(campaign);
		} catch {
			if (!this.destroyed)
				this.error.set(
					'Campaign status could not be loaded. Reload to check progress.',
				);
			return;
		}
		this.scheduleRefresh();
	}
}
