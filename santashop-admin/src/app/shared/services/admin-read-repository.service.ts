import { inject, Injectable, InjectionToken } from '@angular/core';
import {
	collection,
	doc,
	getDoc,
	getDocs,
	query,
	type Firestore,
	type QueryConstraint,
} from 'firebase/firestore/lite';
import { defer, map, type Observable } from 'rxjs';

export const ADMIN_FIRESTORE_LITE = new InjectionToken<Firestore>(
	'Admin Firestore Lite',
);
interface LiteReadMethods {
	collection: typeof collection;
	doc: typeof doc;
	query: typeof query;
	getDoc: typeof getDoc;
	getDocs: typeof getDocs;
}
export const ADMIN_LITE_READ_METHODS = new InjectionToken<LiteReadMethods>(
	'Admin Lite read methods',
	{
		providedIn: 'root',
		factory: (): LiteReadMethods => ({
			collection,
			doc,
			query,
			getDoc,
			getDocs,
		}),
	},
);

export interface AdminReadCollection<T> {
	read(
		documentId: string,
		idField?: Extract<keyof T, string>,
	): Observable<T | undefined>;
	readMany(
		constraints?: QueryConstraint[],
		idField?: Extract<keyof T, string>,
	): Observable<T[]>;
}

/** Server reads only. Each subscription fetches once and completes. */
@Injectable()
export class AdminReadRepository {
	private readonly firestore = inject(ADMIN_FIRESTORE_LITE);
	private readonly methods = inject(ADMIN_LITE_READ_METHODS);

	public collection<T>(path: string): AdminReadCollection<T> {
		return {
			read: (id, idField) =>
				defer(() =>
					this.methods.getDoc(
						this.methods.doc(this.firestore, path, id),
					),
				).pipe(
					map((snapshot) =>
						snapshot.exists()
							? ({
									...snapshot.data(),
									...(idField
										? { [idField]: snapshot.id }
										: {}),
								} as T)
							: undefined,
					),
				),
			readMany: (constraints = [], idField) =>
				defer(() =>
					this.methods.getDocs(
						this.methods.query(
							this.methods.collection(this.firestore, path),
							...constraints,
						),
					),
				).pipe(
					map((snapshot) =>
						snapshot.docs.map(
							(item) =>
								({
									...item.data(),
									...(idField ? { [idField]: item.id } : {}),
								}) as T,
						),
					),
				),
		};
	}
}
