import type { CallableRequest } from 'firebase-functions/v2/https';

interface CallableRequestOptions {
	uid?: string;
	email?: string;
	admin?: boolean;
	owner?: boolean;
	roles?: string[];
	authTime?: number;
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
			owner: options.owner ?? false,
			roles: options.roles ?? [],
			auth_time: options.authTime ?? Math.floor(Date.now() / 1000),
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
