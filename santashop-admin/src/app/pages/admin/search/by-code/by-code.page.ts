import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	UntypedFormGroup,
	UntypedFormControl,
	Validators,
} from '@angular/forms';
import { SearchService } from '../search.service';

@Component({
	selector: 'admin-by-code',
	templateUrl: './by-code.page.html',
	styleUrls: ['./by-code.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByCodePage {
	public readonly form = new UntypedFormGroup({
		code: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(8),
				Validators.minLength(7),
			],
		}),
	});

	constructor(private readonly searchService: SearchService) {}

	public search(): void {
		const data = this.form.value;
		this.searchService.searchByCode(data.code);
	}

	public reset(): void {
		this.form.reset();
	}
}
