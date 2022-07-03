import { filter, map, Observable } from 'rxjs';
import { IRegistration } from '../../../../dist/santashop-models';

type KT<T> = keyof T | undefined | null;

/**
 * Avoids the "no non null assertion operator" issue after filter statements
 * https://github.com/typescript-eslint/typescript-eslint/issues/3866
 *
 * @remarks
 * Use in place of filter(e => ...)
 */
export const filterNilProp =
	<T>(key: keyof T) =>
	(source$: Observable<null | undefined | T>) =>
		source$
			.pipe(
				filter(
					(implied) =>
						inputIsNotNullOrUndefinedTypeGuard(implied) &&
						(implied[key]
							? inputIsNotNullOrUndefinedTypeGuard(implied[key])
							: true)
				)
			)
			.pipe(
				map((implied) => {
					const src: KT<IRegistration> = 'uid';
					console.log(src, src);

					implied as NonNullable<T>;
					if (implied && implied[key]) {
						type I = typeof key;
						implied[key] as NonNullable<T[I]>;
					}
				})
			);

export const filterNil =
	<T>() =>
	(source$: Observable<null | undefined | T>) =>
		source$
			.pipe(
				filter((implied) => inputIsNotNullOrUndefinedTypeGuard(implied))
			)
			.pipe(map((implied) => implied as NonNullable<T>));

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
