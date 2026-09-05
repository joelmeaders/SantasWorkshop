import {
	catchError,
	map,
	of,
	startWith,
	type Observable,
	type OperatorFunction,
} from 'rxjs';

export type ReadState<T> =
	| { status: 'loading'; data?: undefined }
	| { status: 'error'; data?: undefined }
	| { status: 'ready'; data: T };

/** Apply inside switchMap so a failed request does not disable later refreshes. */
export const readState =
	<T>(): OperatorFunction<T, ReadState<T>> =>
	(source: Observable<T>) =>
		source.pipe(
			map((data): ReadState<T> => ({ status: 'ready', data })),
			startWith<ReadState<T>>({ status: 'loading' }),
			catchError(() => of<ReadState<T>>({ status: 'error' })),
		);
