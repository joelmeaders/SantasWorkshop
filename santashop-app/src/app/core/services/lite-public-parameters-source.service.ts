import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { COLLECTION_SCHEMA, PublicParameters } from '@santashop/models';
import type { PublicParametersSource } from '@santashop/core/customer';
import { doc, getDoc } from 'firebase/firestore/lite';
import {
	EMPTY,
	catchError,
	distinctUntilChanged,
	exhaustMap,
	filter,
	from,
	fromEvent,
	map,
	merge,
	Observable,
	shareReplay,
	timer,
} from 'rxjs';
import { FIREBASE_FIRESTORE_LITE } from '../tokens/customer-runtime.token';

const REFRESH_INTERVAL_MS = 60_000;

@Injectable()
export class LitePublicParametersSource implements PublicParametersSource {
	private readonly firestore = inject(FIREBASE_FIRESTORE_LITE);
	private readonly document = inject(DOCUMENT);

	private readonly scheduledRefresh$ = timer(0, REFRESH_INTERVAL_MS).pipe(
		filter(() => this.document.visibilityState === 'visible'),
	);

	private readonly visibleRefresh$ = fromEvent(
		this.document,
		'visibilitychange',
	).pipe(filter(() => this.document.visibilityState === 'visible'));

	private readonly lifecycleRefresh$ = merge(
		this.visibleRefresh$,
		fromEvent(globalThis, 'focus'),
		fromEvent(globalThis, 'online'),
	);

	public readonly publicParameters$: Observable<PublicParameters | undefined> =
		merge(this.scheduledRefresh$, this.lifecycleRefresh$).pipe(
			exhaustMap(() => this.readPublicParameters()),
			distinctUntilChanged(
				(previous, current) =>
					JSON.stringify(previous) === JSON.stringify(current),
			),
			shareReplay({ bufferSize: 1, refCount: true }),
		);

	private readPublicParameters(): Observable<PublicParameters> {
		const reference = doc(
			this.firestore,
			COLLECTION_SCHEMA.parameters,
			'public',
		);

		return from(getDoc(reference)).pipe(
			filter((snapshot) => snapshot.exists()),
			map((snapshot) => snapshot.data() as PublicParameters),
			catchError(() => EMPTY),
		);
	}
}
