import type { Timestamp } from 'firebase-admin/firestore';
import * as dateFormat from 'dateformat';
import { SHOP_TIME_ZONE } from './runtime-config';

type TimestampLike = Pick<Timestamp, 'toDate'>;

export type DateTimeValue = Date | string | TimestampLike;

const isTimestampLike = (value: DateTimeValue): value is TimestampLike => {
	return typeof value === 'object' && value !== null && 'toDate' in value;
};

export const normalizeDateTime = (value: DateTimeValue): Date => {
	if (value instanceof Date) {
		return value;
	}

	if (typeof value === 'string') {
		return new Date(value);
	}

	if (isTimestampLike(value)) {
		return value.toDate();
	}

	return new Date(value);
};

export const formatRegistrationDateTime = (value: DateTimeValue): string => {
	const resolvedDate = normalizeDateTime(value);
	const localizedDate = resolvedDate.toLocaleString('en-US', {
		timeZone: SHOP_TIME_ZONE,
	});

	return dateFormat.default(localizedDate, 'dddd, mmmm d, h:MM TT');
};
