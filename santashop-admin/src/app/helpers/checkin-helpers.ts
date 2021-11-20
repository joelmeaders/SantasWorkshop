import { chain } from 'underscore';
import { Timestamp } from '@firebase/firestore';
import { format } from 'date-fns';
import { IChild } from '@models/*';

export abstract class CheckInHelpers {

  public static sortChildren(children: IChild | Partial<IChild>[]) {
    return chain(children).sortBy('a').value();
  }

  public static childColor(value: string): string | undefined {

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
