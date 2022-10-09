import { filter, map, Observable } from 'rxjs';
import { IRegistration } from 'santashop-models/src/lib/models/registration.model';

/**
 * Avoids the "no non null assertion operator" issue after filter statements
 * https://github.com/typescript-eslint/typescript-eslint/issues/3866
 *
 * @remarks
 * Use in place of filter(e => ...)
 */
export const filterNil =
	<T>() =>
	(source$: Observable<null | undefined | T>) =>
		source$
			.pipe(
				filter((implied) => inputIsNotNullOrUndefinedTypeGuard(implied))
			)
			.pipe(map((implied) => implied as NonNullable<T>));

export const pluckFilterNil =
	<T, K extends keyof T>(key: K) =>
	(source$: Observable<null | undefined | T>) =>
		source$.pipe(
			filter((implied) => inputIsNotNullOrUndefinedTypeGuard(implied)),
			map((implied) => (implied as NonNullable<T>)[key]),
			filterNil()
		);

// TypeGuard
export const inputIsNotNullOrUndefinedTypeGuard = <T>(
	input: null | undefined | T
): input is T => input !== null && input !== undefined;

// RxJs operator

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function test<T extends IRegistration, K extends keyof T>(
	value: T,
	key: K
) {
	console.log(key);
	return value;
}
