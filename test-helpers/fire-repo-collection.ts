import { IFireRepoCollection } from '../santashop-core/src/lib/services/fire-repo-lite.service';

export const repoCollectionStub = <T>(): IFireRepoCollection<T> =>
	({
		read: () => {},
		readMany: () => {},
	}) as any;
