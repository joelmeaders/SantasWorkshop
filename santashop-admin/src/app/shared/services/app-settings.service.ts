import { Injectable, inject } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import {
	PublicParametersSettingsResponse,
	PublishPublicParametersRequest,
	WaitingListSettingsResponse,
	PublishWaitingListSettingsRequest,
} from '@santashop/models';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
	private readonly functions = inject(FunctionsWrapper);
	public async readWaitingList(): Promise<WaitingListSettingsResponse> {
		return (
			await this.functions.callableWrapper<
				Record<string, never>,
				WaitingListSettingsResponse
			>('readWaitingListSettings')({})
		).data;
	}
	public async publishWaitingList(
		request: PublishWaitingListSettingsRequest,
	): Promise<WaitingListSettingsResponse> {
		return (
			await this.functions.callableWrapper<
				PublishWaitingListSettingsRequest,
				WaitingListSettingsResponse
			>('publishWaitingListSettings')(request)
		).data;
	}
	public async read(): Promise<PublicParametersSettingsResponse> {
		return (
			await this.functions.callableWrapper<
				Record<string, never>,
				PublicParametersSettingsResponse
			>('readPublicParametersSettings')({})
		).data;
	}
	public async publish(
		request: PublishPublicParametersRequest,
	): Promise<PublicParametersSettingsResponse> {
		return (
			await this.functions.callableWrapper<
				PublishPublicParametersRequest,
				PublicParametersSettingsResponse
			>('publishPublicParametersSettings')(request)
		).data;
	}
}
