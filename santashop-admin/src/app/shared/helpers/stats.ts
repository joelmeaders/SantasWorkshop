import { FireRepoLite, IFireRepoCollection } from '@santashop/core';
import { COLLECTION_SCHEMA } from '@santashop/models';

export const getStatsCollection = <T>(
	httpService: FireRepoLite,
): IFireRepoCollection<T> =>
	httpService.collection<T>(COLLECTION_SCHEMA.stats);
