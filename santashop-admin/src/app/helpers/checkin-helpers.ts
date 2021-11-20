import { IChildrenInfo } from '@models/*';
import { chain } from 'underscore';
import firebase from 'firebase/compat/app';
import { format } from 'date-fns';

export abstract class CheckInHelpers {

  public static sortChildren(children: IChildrenInfo[]) {
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

  public static friendlyTimestamp(timestamp: firebase.firestore.Timestamp): string {
    return format(timestamp.toDate(), 'MMM dd, YYY h:mm a');
  }
}
