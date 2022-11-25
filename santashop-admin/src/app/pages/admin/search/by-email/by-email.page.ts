import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
	UntypedFormGroup,
	UntypedFormControl,
	Validators,
} from '@angular/forms';
import { SearchService } from '../search.service';

@Component({
	selector: 'admin-by-email',
	templateUrl: './by-email.page.html',
	styleUrls: ['./by-email.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ByEmailPage {
	public readonly form = new UntypedFormGroup({
		emailAddress: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [Validators.required, Validators.email],
		}),
	});

	constructor(private readonly searchService: SearchService) {}

	public search(): void {
		const data = this.form.value;
		this.searchService.searchByEmail(data.emailAddress);
	}

	public reset(): void {
		this.form.reset();
	}
}
