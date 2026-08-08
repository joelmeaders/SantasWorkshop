import { Injectable, inject } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core';
import {
	type ResolveRegistrationScanRequest,
	type ResolveRegistrationScanResult,
} from '@santashop/models';

const deserializeCallableTimestamps = (value: unknown): unknown => {
	if (value instanceof Date || value === null || typeof value !== 'object') {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((entry) => deserializeCallableTimestamps(entry));
	}

	const record = value as Record<string, unknown>;
	const seconds =
		typeof record['seconds'] === 'number'
			? record['seconds']
			: typeof record['_seconds'] === 'number'
				? record['_seconds']
				: undefined;
	const nanoseconds =
		typeof record['nanoseconds'] === 'number'
			? record['nanoseconds']
			: typeof record['_nanoseconds'] === 'number'
				? record['_nanoseconds']
				: 0;
	if (seconds !== undefined) {
		return new Date(seconds * 1000 + Math.floor(nanoseconds / 1_000_000));
	}

	return Object.fromEntries(
		Object.entries(record).map(([key, entry]) => [
			key,
			deserializeCallableTimestamps(entry),
		]),
	);
};

@Injectable({ providedIn: 'root' })
export class RegistrationScanService {
	private readonly functions = inject(FunctionsWrapper);

	public async resolve(
		request: ResolveRegistrationScanRequest,
	): Promise<ResolveRegistrationScanResult> {
		const response = await this.functions.callableWrapper<
			ResolveRegistrationScanRequest,
			ResolveRegistrationScanResult
		>('resolveRegistrationScan')(request);
		return deserializeCallableTimestamps(
			response.data,
		) as ResolveRegistrationScanResult;
	}
}
