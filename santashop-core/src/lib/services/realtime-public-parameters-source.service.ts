import { inject, Injectable } from '@angular/core';
import { COLLECTION_SCHEMA, PublicParameters } from '@santashop/models';
import type { Observable } from 'rxjs';
import type { PublicParametersSource } from '../tokens';
import { FireRepoLite } from './fire-repo-lite.service';

@Injectable()
export class RealtimePublicParametersSource implements PublicParametersSource {
	private readonly fireRepo = inject(FireRepoLite);

	public readonly publicParameters$: Observable<PublicParameters | undefined> =
		this.fireRepo
			.collection<PublicParameters>(COLLECTION_SCHEMA.parameters)
			.read('public');
}
