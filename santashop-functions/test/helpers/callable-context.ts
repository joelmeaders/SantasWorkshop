import type { CallableRequest } from 'firebase-functions/v2/https';

interface CallableRequestOptions {
	uid?: string;
	email?: string;
	admin?: boolean;
}

export const createCallableRequest = <TData>(
	data: TData,
	options: CallableRequestOptions = {},
): CallableRequest<TData> => {
	const uid = options.uid ?? 'test-user-123';
	const email = options.email ?? 'buddy.elf@example.com';
	const auth: unknown = {
		uid,
		rawToken: 'test-id-token',
		token: {
			email,
			admin: options.admin ?? false,
		},
	};

	const request: unknown = {
		data,
		auth: auth as NonNullable<CallableRequest<TData>['auth']>,
		acceptsStreaming: false,
		rawRequest: {} as CallableRequest<TData>['rawRequest'],
	};

	return request as CallableRequest<TData>;
};
