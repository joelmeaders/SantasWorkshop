import { Type } from '@angular/core';
import 'reflect-metadata';

export type Spied<T> = T & {
	[K in keyof T]: T[K] extends jasmine.Func ? T[K] & jasmine.Spy<T[K]> : T[K];
};

const autoMockCollection = '__autoMockCollection';

export function automock(target: any, memberName: string): any {
	const autoMocks = (): string[] => Reflect.get(target, autoMockCollection);

	if (!autoMocks()) {
		Reflect.defineProperty(target, autoMockCollection, {
			value: [memberName],
			writable: true,
			enumerable: true,
		});
		return;
	}

	Reflect.set(target, autoMockCollection, autoMocks().concat(memberName));
}

function getPrototypeFunctions(
	prototype: any
): (string | PropertyDescriptor | undefined)[] {
	return Object.getOwnPropertyNames(prototype)
		.map((objectName) => [
			objectName,
			Object.getOwnPropertyDescriptor(prototype, objectName),
		])
		.filter(([_objectName, descriptor]) => {
			return (descriptor as PropertyDescriptor).value instanceof Function;
		})
		.map(([name]) => name);
}

function autoSpyOnClass<T>(spiedClass: Type<T>) {
	const prototype = spiedClass.prototype;
	const methods = getPrototypeFunctions(prototype);
	const properties: string[] = prototype[autoMockCollection];

	return jasmine.createSpyObj<T>(
		spiedClass.prototype.name,
		methods as any,
		properties as any
	);
}

export function autoSpyProvider<T>(spiedClass: Type<T>) {
	return {
		provide: spiedClass,
		useValue: autoSpyOnClass(spiedClass),
	};
}

export function getPropertySpy<T>(
	service: Spied<T>,
	key: keyof T
): jasmine.Spy {
	return Object.getOwnPropertyDescriptor(service, key)?.get as jasmine.Spy;
}

export function getFunctionSpy<T>(
	service: Spied<T>,
	functionName: keyof T
): jasmine.Spy {
	return (service as any)[functionName] as jasmine.Spy;
}
