import { chain } from 'underscore';
import { Timestamp } from '@firebase/firestore';
import { format } from 'date-fns';
import { IChild } from '@models/*';

export abstract class CheckInHelpers {

  public static sortChildren(children: IChild | Partial<IChild>[]) {
    return chain(children).sortBy('ageGroup').value();
  }

  public static childColor(value: string): string | undefined {

    console.log('TODO1', value)

    switch (value) {
      case 'b':
        return 'boy';

      case 'g':
        return 'girl';

        case 'i':
        return 'infant';
    }

    return undefined;
  }

  public static friendlyTimestamp(timestamp: Timestamp | any): string {
    return format(timestamp.toDate(), 'MMM dd, YYY h:mm a');
  }
}
