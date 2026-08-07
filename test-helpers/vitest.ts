import { Type } from '@angular/core';
import { type MockInstance, type Mocked, vi } from 'vitest';
import { AUTOMOCK_COLLECTION } from '../santashop-core/src';

export type Spied<T> = Mocked<T>;

export function createMock<T>(methods: readonly (keyof T)[]): Mocked<T> {
	const mock: Record<string, unknown> = {};
	for (const method of methods) {
		mock[String(method)] = vi.fn();
	}
	return mock as Mocked<T>;
}

function getPrototypeFunctions(prototype: object): string[] {
	return Object.getOwnPropertyNames(prototype).filter((name) => {
		return Object.getOwnPropertyDescriptor(prototype, name)?.value instanceof Function;
	});
}

function autoSpyOnClass<T>(spiedClass: Type<T>): Mocked<T> {
	const mock: Record<string, unknown> = {};

	for (const method of getPrototypeFunctions(spiedClass.prototype)) {
		mock[method] = vi.fn();
	}

	for (const property of spiedClass.prototype[AUTOMOCK_COLLECTION] ?? []) {
		Object.defineProperty(mock, property, {
			configurable: true,
			get: vi.fn(),
		});
	}

	return mock as Mocked<T>;
}

export function autoSpyProvider<T>(spiedClassType: Type<T>) {
	return {
		provide: spiedClassType,
		useValue: autoSpyOnClass(spiedClassType),
	};
}

export function getPropertySpy<T>(service: Spied<T>, key: keyof T): MockInstance {
	return Object.getOwnPropertyDescriptor(service, key)?.get as unknown as MockInstance;
}

export function getFunctionSpy<T>(service: Spied<T>, functionName: keyof T): MockInstance {
	return service[functionName] as MockInstance;
}
