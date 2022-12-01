import {
	UnaryFunction,
	Observable,
	pipe,
	filter,
	OperatorFunction,
} from 'rxjs';

export const filterNullish = <T>(): UnaryFunction<
	Observable<T | null | undefined>,
	Observable<T>
> =>
	pipe(filter((x) => x != null) as OperatorFunction<T | null | undefined, T>);
