import { Injectable, inject } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import type {
	WaitingListCampaign,
	WaitingListCampaignPreview,
	WaitingListCampaignRequest,
	StartWaitingListCampaignRequest,
} from '@santashop/models';

@Injectable({ providedIn: 'root' })
export class WaitingListCampaignService {
	private readonly functions = inject(FunctionsWrapper);
	public async preview(): Promise<WaitingListCampaignPreview> {
		return (
			await this.functions.callableWrapper<
				Record<string, never>,
				WaitingListCampaignPreview
			>('previewWaitingListCampaign')({})
		).data;
	}
	public async start(
		request: StartWaitingListCampaignRequest,
	): Promise<WaitingListCampaign> {
		return (
			await this.functions.callableWrapper<
				StartWaitingListCampaignRequest,
				WaitingListCampaign
			>('startWaitingListCampaign')(request)
		).data;
	}
	public async read(campaignId: string): Promise<WaitingListCampaign> {
		return (
			await this.functions.callableWrapper<
				WaitingListCampaignRequest,
				WaitingListCampaign
			>('getWaitingListCampaign')({ campaignId })
		).data;
	}
	public async list(): Promise<WaitingListCampaign[]> {
		return (
			await this.functions.callableWrapper<
				Record<string, never>,
				WaitingListCampaign[]
			>('listWaitingListCampaigns')({})
		).data;
	}
	public async resume(campaignId: string): Promise<WaitingListCampaign> {
		return (
			await this.functions.callableWrapper<
				WaitingListCampaignRequest,
				WaitingListCampaign
			>('resumeWaitingListCampaign')({ campaignId })
		).data;
	}
}
