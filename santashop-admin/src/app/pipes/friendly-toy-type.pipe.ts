import { Pipe, PipeTransform } from '@angular/core';
import { ToyType } from '../../../../santashop-models/src/public-api';

@Pipe({
	name: 'friendlyToyType',
})
export class FriendlyToyTypePipe implements PipeTransform {
	transform(value: ToyType): string | undefined {
		switch (value) {
			case ToyType.infant:
				return 'Infant';

			case ToyType.boy:
				return 'Boy';

			case ToyType.girl:
				return 'Girl';

			default:
				return undefined;
		}
	}
}
