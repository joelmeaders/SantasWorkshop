import { Injectable, inject } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import {
	PublicParametersSettingsResponse,
	PublishPublicParametersRequest,
} from '@santashop/models';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
	private readonly functions = inject(FunctionsWrapper);
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
