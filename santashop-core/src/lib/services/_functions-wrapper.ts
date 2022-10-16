import { Injectable } from '@angular/core';
import { Functions as _Functions, httpsCallable } from '@angular/fire/functions';
import { ChangeUserInfo } from '@models/*';

export type Functions = _Functions;

@Injectable({
	providedIn: 'root',
})
export class FunctionsWrapper {
	constructor(private readonly functions: _Functions) {}

	public readonly httpsCallable = (name: string) =>
		httpsCallable(this.functions, name);

	public readonly updateEmailAddress = (newEmailAddress: string) =>
		this.httpsCallable('updateEmailAddress')({
			emailAddress: newEmailAddress,
		});

	public readonly changeAccountInformation = (newInfo: ChangeUserInfo) =>
		this.httpsCallable('changeAccountInformation')(newInfo);

	public readonly undoRegistration = () => 
		this.httpsCallable('undoRegistration')({})
}
