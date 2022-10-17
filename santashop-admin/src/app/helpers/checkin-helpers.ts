import { chain } from 'underscore';
import { Timestamp } from '@firebase/firestore';
import { format } from 'date-fns';
import { Child, ToyType } from '../../../../santashop-models/src/public-api';

export abstract class CheckInHelpers {
	public static sortChildren(children: Child | Partial<Child>[]) {
		return chain(children).sortBy('ageGroup').value();
	}

	public static childColor(value: ToyType): string | undefined {
		switch (value) {
			case ToyType.boy:
				return 'boy';

			case ToyType.girl:
				return 'girl';

			case ToyType.infant:
				return 'infant';

			default:
				return undefined;
		}
	}

	public static friendlyTimestamp(timestamp: Timestamp | any): string {
		return format(timestamp.toDate(), 'MMM dd, YYY h:mm a');
	}
}
