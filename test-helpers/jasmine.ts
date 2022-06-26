import { Type } from '@angular/core';

export type Spied<T> = SpiedMethods<T> & SpiedProperties<T>;

export type SpiedMethods<T> = {
  [Method in keyof T]: T[Method] & jasmine.Spy;
};

export type SpiedProperties<T> = {
  [P in keyof T]: T[P] & jasmine.Spy;
};

export function spyOnClass<T>(spiedClass: Type<T>, properties: string[]) {
  const prototype = spiedClass.prototype;

  const methods = Object.getOwnPropertyNames(prototype)
    // Object.getOwnPropertyDescriptor is required to filter functions
    .map((name) => [name, Object.getOwnPropertyDescriptor(prototype, name)])
    .filter(([__name, descriptor]) => {
      // select only functions
      return (descriptor as PropertyDescriptor).value instanceof Function;
    })
    .map(([name]) => name);

  // return spy object
  return jasmine.createSpyObj('spy', [...methods], [...properties]);
}

export function provideMock<T>(spiedClass: Type<T>, ...properties: string[]) {
  return {
    provide: spiedClass,
    useValue: spyOnClass(spiedClass, properties),
  };
}
