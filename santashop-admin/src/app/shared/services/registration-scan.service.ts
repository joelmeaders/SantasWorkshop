import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, map } from 'rxjs';
import { AuthService } from '@santashop/core/admin';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
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
	private readonly auth = inject(AuthService);
	private identityVersion = 0;
	constructor() {
		this.auth.uid$
			.pipe(takeUntilDestroyed())
			.subscribe(() => this.identityVersion++);
	}

	public async resolve(
		request: ResolveRegistrationScanRequest,
	): Promise<ResolveRegistrationScanResult> {
		const { uid, version } = await firstValueFrom(
			this.auth.uid$.pipe(
				map((uid) => ({ uid, version: this.identityVersion })),
			),
		);
		if (!uid || version !== this.identityVersion)
			throw new Error('Sign in before scanning a registration.');
		const response = await this.functions.callableWrapper<
			ResolveRegistrationScanRequest,
			ResolveRegistrationScanResult
		>('resolveRegistrationScan')(request);
		if (version !== this.identityVersion)
			throw new Error('The signed-in account changed during the scan.');
		return deserializeCallableTimestamps(
			response.data,
		) as ResolveRegistrationScanResult;
	}
}
