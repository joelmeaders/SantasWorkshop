import { IChildrenInfo } from 'santashop-core/src/lib/models';
import { chain } from 'underscore';
import firebase from 'firebase/compat/app';
import { format } from 'date-fns';

export abstract class CheckInHelpers {

  public static sortChildren(children: IChildrenInfo[]) {
    return chain(children).sortBy('a').value();
  }

  public static childColor(value: string): string {
    switch (value) {
      case 'b':
        return 'boy';

      case 'g':
        return 'girl';

        case 'i':
        return 'infant';
    }
  }

  public static friendlyTimestamp(timestamp: firebase.firestore.Timestamp): string {
    return format(timestamp.toDate(), 'MMM dd, YYY h:mm a');
  }
}
