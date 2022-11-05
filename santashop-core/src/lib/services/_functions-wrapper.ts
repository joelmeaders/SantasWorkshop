import { Injectable } from '@angular/core';
import {
	Functions as _Functions,
	httpsCallable,
	HttpsCallable as _HttpsCallable,
	HttpsCallableResult as _HttpsCallableResult,
} from '@angular/fire/functions';
import { ChangeUserInfo, UpdateReferredBy } from '@models/*';

export type Functions = _Functions;
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
	constructor(private readonly functions: _Functions) {}

	public readonly callableWrapper = <RequestData, ResponseData>(
		name: string
	): HttpsCallable<RequestData, ResponseData> =>
		httpsCallable(this.functions, name);

	public readonly updateEmailAddress = <ResponseData>(
		newEmailAddress: string
	): Promise<_HttpsCallableResult<ResponseData>> =>
		this.callableWrapper<{ emailAddress: string }, ResponseData>(
			'updateEmailAddress'
		)({
			emailAddress: newEmailAddress,
		});

	public readonly changeAccountInformation = (
		data: ChangeUserInfo
	): Promise<_HttpsCallableResult<unknown>> =>
		this.callableWrapper<ChangeUserInfo, unknown>(
			'changeAccountInformation'
		)(data);

	public readonly updateReferredBy = (
		data: UpdateReferredBy
	): Promise<_HttpsCallableResult<unknown>> =>
		this.callableWrapper<UpdateReferredBy, any>('updateReferredBy')({
			...data,
		});

	public readonly undoRegistration = (): Promise<
		_HttpsCallableResult<unknown>
	> => this.callableWrapper<unknown, unknown>('undoRegistration')({});
}
