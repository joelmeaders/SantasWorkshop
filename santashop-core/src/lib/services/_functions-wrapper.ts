import { Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { IChangeUserInfo } from 'dist/santashop-models/lib';

@Injectable({
	providedIn: 'root',
})
export class FunctionsWrapper {
	constructor(private readonly functions: Functions) {}

	public readonly httpsCallable = (name: string) =>
		httpsCallable(this.functions, name);

	public readonly updateEmailAddress = (newEmailAddress: string) =>
		this.httpsCallable('updateEmailAddress')({
			emailAddress: newEmailAddress,
		});

	public readonly changeAccountInformation = (newInfo: IChangeUserInfo) =>
		this.httpsCallable('changeAccountInformation')(newInfo);
}
