import 'reflect-metadata';

export const AUTOMOCK_COLLECTION = '__autoMockCollection';

export const automock = (target: any, memberName: string): any => {
	const autoMocks = (): string[] => Reflect.get(target, AUTOMOCK_COLLECTION);

	if (!autoMocks()) {
		Reflect.defineProperty(target, AUTOMOCK_COLLECTION, {
			value: [memberName],
			writable: true,
			enumerable: true,
		});
		return;
	}

	Reflect.set(target, AUTOMOCK_COLLECTION, autoMocks().concat(memberName));
};
