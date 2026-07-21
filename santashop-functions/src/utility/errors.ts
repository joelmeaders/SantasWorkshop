interface ErrorLike {
	code?: unknown;
	message?: unknown;
	status?: unknown;
}

const toScalarString = (value: unknown): string => {
	if (typeof value === 'string') {
		return value;
	}

	if (
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'bigint'
	) {
		return `${value}`;
	}

	return JSON.stringify(value);
};

const isErrorLike = (error: unknown): error is ErrorLike => {
	return typeof error === 'object' && error !== null;
};

export const getErrorCode = (error: unknown): string | undefined => {
	if (!isErrorLike(error) || error.code === undefined) {
		return undefined;
	}

	return toScalarString(error.code);
};

export const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	if (isErrorLike(error) && error.message !== undefined) {
		return toScalarString(error.message);
	}

	return toScalarString(error);
};

export const getErrorStatus = (error: unknown): string | undefined => {
	if (!isErrorLike(error) || error.status === undefined) {
		return undefined;
	}

	return toScalarString(error.status);
};

export const serializeError = (error: unknown): string => {
	if (error instanceof Error) {
		return JSON.stringify({
			name: error.name,
			message: error.message,
			stack: error.stack,
		});
	}

	return JSON.stringify(error);
};
