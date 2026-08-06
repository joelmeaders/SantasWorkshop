import { Injectable, inject } from '@angular/core';
import {
	httpsCallable,
	HttpsCallable as _HttpsCallable,
	HttpsCallableResult as _HttpsCallableResult,
} from 'firebase/functions';
import { ChangeUserInfo, ToyType, UpdateReferredBy } from '@santashop/models';
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

	public readonly undoRegistration = (data: {
		mutationId: string;
		uid?: string;
	}): Promise<_HttpsCallableResult<true>> =>
		this.callableWrapper<typeof data, true>('undoRegistration')(data);

	public readonly changeRegistrationDateTime = (
		data: {
			mutationId: string;
			slotId: string;
			registrationUid?: string;
		},
	): Promise<_HttpsCallableResult<true>> =>
		this.callableWrapper<typeof data, true>('changeRegistrationDateTime')(data);

	public readonly saveDraftChild = (data: {
		mutationId: string;
		child: {
			id: number;
			firstName: string;
			lastName: string;
			dateOfBirth: string;
			toyType?: ToyType;
		};
	}): Promise<_HttpsCallableResult<true>> =>
		this.callableWrapper<typeof data, true>('saveDraftChild')(data);

	public readonly deleteDraftChild = (data: {
		mutationId: string;
		childId: number;
	}): Promise<_HttpsCallableResult<true>> =>
		this.callableWrapper<typeof data, true>('deleteDraftChild')(data);

	public readonly setDraftAppointment = (data: {
		mutationId: string;
		slotId: string;
	}): Promise<_HttpsCallableResult<true>> =>
		this.callableWrapper<typeof data, true>('setDraftAppointment')(data);

	public readonly completeRegistration = (data: {
		mutationId: string;
	}): Promise<_HttpsCallableResult<true>> =>
		this.callableWrapper<typeof data, true>('completeRegistration')(data);
}
