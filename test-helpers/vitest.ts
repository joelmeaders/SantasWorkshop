import { type Mocked, vi } from 'vitest';

export type Spied<T> = Mocked<T>;

export function createMock<T>(methods: readonly (keyof T)[]): Mocked<T> {
	const mock: Record<string, unknown> = {};
	for (const method of methods) {
		mock[String(method)] = vi.fn();
	}
	return mock as Mocked<T>;
}
