import { Injectable, inject } from '@angular/core';
import {
	FunctionsWrapper,
	HttpsCallableResult,
} from '@santashop/core';
import {
	GetOwnerExportUrlResponse,
	GetOwnerOperationRequest,
	OwnerOperation,
	PreviewOwnerOperationRequest,
	PreviewOwnerOperationResponse,
	StartOwnerOperationRequest,
	StartOwnerOperationResponse,
} from '@santashop/models';

@Injectable({ providedIn: 'root' })
export class OwnerOperationsService {
	private readonly functions = inject(FunctionsWrapper);

	public async preview(
		request: PreviewOwnerOperationRequest,
	): Promise<PreviewOwnerOperationResponse> {
		const result: HttpsCallableResult<PreviewOwnerOperationResponse> =
			await this.functions.callableWrapper<
				PreviewOwnerOperationRequest,
				PreviewOwnerOperationResponse
			>('callablePreviewOwnerOperation')(request);
		return result.data;
	}

	public async start(
		request: StartOwnerOperationRequest,
	): Promise<StartOwnerOperationResponse> {
		const result: HttpsCallableResult<StartOwnerOperationResponse> =
			await this.functions.callableWrapper<
				StartOwnerOperationRequest,
				StartOwnerOperationResponse
			>('callableStartOwnerOperation')(request);
		return result.data;
	}

	public async get(operationId: string): Promise<OwnerOperation> {
		const result: HttpsCallableResult<OwnerOperation> =
			await this.functions.callableWrapper<
				GetOwnerOperationRequest,
				OwnerOperation
			>('callableGetOwnerOperation')({ operationId });
		return result.data;
	}

	public async getExportUrl(
		operationId: string,
	): Promise<GetOwnerExportUrlResponse> {
		const result: HttpsCallableResult<GetOwnerExportUrlResponse> =
			await this.functions.callableWrapper<
				GetOwnerOperationRequest,
				GetOwnerExportUrlResponse
			>('callableGetOwnerExportUrl')({ operationId });
		return result.data;
	}
}
