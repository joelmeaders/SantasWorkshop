import { Injectable, inject } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core/customer';
import type {
	SetWaitingListMembershipRequest,
	WaitingListState,
} from '@santashop/models';

@Injectable({ providedIn: 'root' })
export class WaitingListService {
	private readonly functions = inject(FunctionsWrapper);
	public async read(): Promise<WaitingListState> {
		return (
			await this.functions.callableWrapper<
				Record<string, never>,
				WaitingListState
			>('getWaitingListState')({})
		).data;
	}
	public async set(request: SetWaitingListMembershipRequest): Promise<void> {
		await this.functions.callableWrapper<SetWaitingListMembershipRequest, true>(
			'setWaitingListMembership',
		)(request);
	}
}
