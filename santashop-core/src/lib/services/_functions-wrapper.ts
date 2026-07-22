import { Injectable, inject } from '@angular/core';
import {
	httpsCallable,
	HttpsCallable as _HttpsCallable,
	HttpsCallableResult as _HttpsCallableResult,
} from 'firebase/functions';
import { ChangeUserInfo, UpdateReferredBy } from '@santashop/models';
import { FIREBASE_FUNCTIONS } from '../tokens';

export type HttpsCallable<RequestData, ResponseData> = _HttpsCallable<
	RequestData,
	ResponseData
>;

export type HttpsCallableResult<ResponseData> =
	_HttpsCallableResult<ResponseData>;

@Injectable({
	providedIn: 'root',
})
export class FunctionsWrapper {
	private readonly functions = inject(FIREBASE_FUNCTIONS);

	public readonly callableWrapper = <RequestData, ResponseData>(
		name: string,
	): HttpsCallable<RequestData, ResponseData> =>
		httpsCallable(this.functions, name);

	public readonly updateEmailAddress = <ResponseData>(
		newEmailAddress: string,
	): Promise<_HttpsCallableResult<ResponseData>> =>
		this.callableWrapper<{ emailAddress: string }, ResponseData>(
			'updateEmailAddress',
		)({
			emailAddress: newEmailAddress,
		});

	public readonly changeAccountInformation = (
		data: ChangeUserInfo,
	): Promise<_HttpsCallableResult<unknown>> =>
		this.callableWrapper<ChangeUserInfo, unknown>(
			'changeAccountInformation',
		)(data);

	public readonly updateReferredBy = (
		data: UpdateReferredBy,
	): Promise<_HttpsCallableResult<unknown>> =>
		this.callableWrapper<UpdateReferredBy, any>('updateReferredBy')({
			...data,
		});

	public readonly undoRegistration = (): Promise<
		_HttpsCallableResult<unknown>
	> => this.callableWrapper<unknown, unknown>('undoRegistration')({});

	public readonly changeRegistrationDateTime = (
		data: unknown,
	): Promise<_HttpsCallableResult<unknown>> =>
		this.callableWrapper<unknown, unknown>('changeRegistrationDateTime')(
			data,
		);
}
