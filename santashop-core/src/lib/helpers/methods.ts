export const deepCopy = <T>(source: T): T => {
	if (Array.isArray(source)) {
		return source.map((item) => deepCopy(item)) as T;
	}

	if (source instanceof Date) {
		return new Date(source) as T;
	}

	if (source && typeof source === 'object') {
		return Object.getOwnPropertyNames(source).reduce(
			(o, prop) => {
				const descriptor = Object.getOwnPropertyDescriptor(
					source,
					prop,
				);
				if (descriptor) {
					Object.defineProperty(o, prop, descriptor);
				}
				o[prop] = deepCopy((source as Record<string, unknown>)[prop]);
				return o;
			},
			Object.create(Object.getPrototypeOf(source)),
		) as T;
	}

	return source;
};
