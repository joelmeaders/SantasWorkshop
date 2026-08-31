import { Injectable, inject } from '@angular/core';
import { orderBy, QueryConstraint } from 'firebase/firestore';
import { FireRepoLite, FunctionsWrapper } from '@santashop/core';
import {
	COLLECTION_SCHEMA,
	CreateStaffUser,
	DeleteStaffUser,
	StaffAccount,
	UpdateStaffUser,
} from '@santashop/models';
import { Observable, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StaffService {
	private readonly repoService = inject(FireRepoLite);
	private readonly functions = inject(FunctionsWrapper);

	private readonly staffCollection = this.repoService.collection<StaffAccount>(
		COLLECTION_SCHEMA.staff,
	);

	/**
	 * Live stream of the elevated staff accounts, ordered by display name.
	 * Only readable by admins per Firestore rules.
	 *
	 * @memberof StaffService
	 */
	public readonly staffAccounts$: Observable<StaffAccount[]> =
		this.staffCollection
			.readMany([orderBy('displayName', 'asc')] as QueryConstraint[], 'uid')
			.pipe(shareReplay(1));

	public async createStaffUser(data: CreateStaffUser): Promise<string> {
		const result = await this.functions.callableWrapper<
			CreateStaffUser,
			string
		>('callableCreateStaffUser')(data);
		return result.data;
	}

	public async updateStaffUser(data: UpdateStaffUser): Promise<void> {
		await this.functions.callableWrapper<UpdateStaffUser, void>(
			'callableUpdateStaffUser',
		)(data);
	}

	public async deleteStaffUser(uid: string): Promise<void> {
		await this.functions.callableWrapper<DeleteStaffUser, void>(
			'callableDeleteStaffUser',
		)({ uid });
	}
}
