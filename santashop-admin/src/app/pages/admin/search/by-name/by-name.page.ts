import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	UntypedFormGroup,
	UntypedFormControl,
	Validators,
} from '@angular/forms';
import { SearchService } from '../search.service';

@Component({
	selector: 'admin-by-name',
	templateUrl: './by-name.page.html',
	styleUrls: ['./by-name.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByNamePage {
	public readonly form = new UntypedFormGroup({
		lastName: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: Validators.required,
		}),
		zipCode: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(5),
				Validators.minLength(5),
			],
		}),
	});

	constructor(private readonly searchService: SearchService) {}

	public search(): void {
		const data = this.form.value;
		this.searchService.searchByLastNameZip(data.lastName, data.zipCode);
	}

	public reset(): void {
		this.form.reset();
	}
}
