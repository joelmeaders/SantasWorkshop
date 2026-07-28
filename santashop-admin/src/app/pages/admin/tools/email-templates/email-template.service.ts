import { Injectable, inject } from '@angular/core';
import { FunctionsWrapper, HttpsCallableResult } from '@santashop/core';
import type {
	EmailTemplateDetail,
	EmailTemplateSummary,
	GetEmailTemplateRequest,
	GetEmailTemplateRevisionRequest,
	GetEmailTemplateRevisionResponse,
	PublishEmailTemplateRequest,
	PublishEmailTemplateResponse,
	SaveEmailTemplateRevisionRequest,
	SaveEmailTemplateRevisionResponse,
} from '@santashop/models';

@Injectable({
	providedIn: 'root',
})
export class EmailTemplateService {
	private readonly functions = inject(FunctionsWrapper);

	public async listEmailTemplates(): Promise<EmailTemplateSummary[]> {
		const result = await this.functions
			.callableWrapper<unknown, EmailTemplateSummary[]>(
				'callableListEmailTemplates',
			)({});
		return result.data;
	}

	public async getEmailTemplate(
		key: string,
	): Promise<EmailTemplateDetail> {
		const result = await this.functions.callableWrapper<
			GetEmailTemplateRequest,
			EmailTemplateDetail
		>('callableGetEmailTemplate')({ key });
		return result.data;
	}

	public async getEmailTemplateRevision(
		payload: GetEmailTemplateRevisionRequest,
	): Promise<GetEmailTemplateRevisionResponse> {
		const result: HttpsCallableResult<GetEmailTemplateRevisionResponse> =
			await this.functions.callableWrapper<
				GetEmailTemplateRevisionRequest,
				GetEmailTemplateRevisionResponse
			>('callableGetEmailTemplateRevision')(payload);
		return result.data;
	}

	public async saveEmailTemplateRevision(
		payload: SaveEmailTemplateRevisionRequest,
	): Promise<SaveEmailTemplateRevisionResponse> {
		const result: HttpsCallableResult<SaveEmailTemplateRevisionResponse> =
			await this.functions.callableWrapper<
				SaveEmailTemplateRevisionRequest,
				SaveEmailTemplateRevisionResponse
			>('callableSaveEmailTemplateRevision')(payload);
		return result.data;
	}

	public async publishEmailTemplate(
		payload: PublishEmailTemplateRequest,
	): Promise<PublishEmailTemplateResponse> {
		const result: HttpsCallableResult<PublishEmailTemplateResponse> =
			await this.functions.callableWrapper<
				PublishEmailTemplateRequest,
				PublishEmailTemplateResponse
			>('callablePublishEmailTemplate')(payload);
		return result.data;
	}
}
