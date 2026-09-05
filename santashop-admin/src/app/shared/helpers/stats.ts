import {
	AdminReadRepository,
	type AdminReadCollection,
} from '../services/admin-read-repository.service';
import { COLLECTION_SCHEMA } from '@santashop/models';

export const getStatsCollection = <T>(
	httpService: AdminReadRepository,
): AdminReadCollection<T> => httpService.collection<T>(COLLECTION_SCHEMA.stats);
