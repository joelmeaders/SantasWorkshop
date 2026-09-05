import { AdminReadRepository } from '../../../shared/services/admin-read-repository.service';
import { Injectable, inject } from '@angular/core';
import { orderBy, QueryConstraint } from 'firebase/firestore/lite';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import {
	COLLECTION_SCHEMA,
	CreateStaffUser,
	DeleteStaffUser,
	StaffAccount,
	UpdateStaffUser,
} from '@santashop/models';
import {
	BehaviorSubject,
	catchError,
	filter,
	map,
	of,
	shareReplay,
	startWith,
	switchMap,
} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StaffService {
	private readonly repoService = inject(AdminReadRepository);
	private readonly functions = inject(FunctionsWrapper);

	private readonly staffCollection =
		this.repoService.collection<StaffAccount>(COLLECTION_SCHEMA.staff);

	private readonly refreshTrigger = new BehaviorSubject<void>(undefined);
	public readonly state$ = this.refreshTrigger.pipe(
		switchMap(() =>
			this.staffCollection
				.readMany(
					[orderBy('displayName', 'asc')] as QueryConstraint[],
					'uid',
				)
				.pipe(
					map((accounts) => ({ status: 'ready' as const, accounts })),
					startWith({
						status: 'loading' as const,
						accounts: [] as StaffAccount[],
					}),
					catchError(() =>
						of({
							status: 'error' as const,
							accounts: [] as StaffAccount[],
						}),
					),
				),
		),
		shareReplay({ bufferSize: 1, refCount: true }),
	);
	public readonly staffAccounts$ = this.state$.pipe(
		filter((state) => state.status === 'ready'),
		map((state) => state.accounts),
	);

	public refresh(): void {
		this.refreshTrigger.next();
	}

	public async createStaffUser(data: CreateStaffUser): Promise<string> {
		const result = await this.functions.callableWrapper<
			CreateStaffUser,
			string
		>('callableCreateStaffUser')(data);
		this.refresh();
		return result.data;
	}

	public async updateStaffUser(data: UpdateStaffUser): Promise<void> {
		await this.functions.callableWrapper<UpdateStaffUser, void>(
			'callableUpdateStaffUser',
		)(data);
		this.refresh();
	}

	public async deleteStaffUser(uid: string): Promise<void> {
		await this.functions.callableWrapper<DeleteStaffUser, void>(
			'callableDeleteStaffUser',
		)({ uid });
		this.refresh();
	}
}
