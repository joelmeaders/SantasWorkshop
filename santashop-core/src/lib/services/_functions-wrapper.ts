import { Injectable } from '@angular/core';
import {
	Functions as _Functions,
	HttpsCallable as _HttpsCallable,
	HttpsCallableResult as _HttpsCallableResult,
} from '@angular/fire/functions';
import { httpsCallable } from '@firebase/functions';
import { ChangeUserInfo } from '@models/*';

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

	public readonly httpsCallable = <RequestData, ResponseData>(
		name: string
	): HttpsCallable<RequestData, ResponseData> =>
		httpsCallable(this.functions, name);

	public readonly updateEmailAddress = <ResponseData>(
		newEmailAddress: string
	): Promise<_HttpsCallableResult<ResponseData>> =>
		this.httpsCallable<{ emailAddress: string }, ResponseData>(
			'updateEmailAddress'
		)({
			emailAddress: newEmailAddress,
		});

	public readonly changeAccountInformation = (
		newInfo: ChangeUserInfo
	): Promise<_HttpsCallableResult<unknown>> =>
		this.httpsCallable<ChangeUserInfo, unknown>('changeAccountInformation')(
			newInfo
		);

	// TODO
	// public readonly undoRegistration = () => this.httpsCallable('');
}
