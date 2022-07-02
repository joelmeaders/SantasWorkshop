import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'niceFormError',
})
export class NiceFormErrorPipe implements PipeTransform {
	transform(key: string | any, args: string | any): string {
		switch (key as string) {
			case 'required':
				return this.required();

			case 'minlength':
				return this.minLength(args as string);

			case 'maxlength':
				return this.maxLength(args as string);

			case 'email':
				return this.email();

			case 'url':
				return this.website();

			case 'zipCode':
				return this.zipCode();

			case 'fieldsMatch':
				return this.fieldsMatch();
		}

		return 'errorrrrrrr';
	}

	private readonly minLength = (args: any): string =>
		`Must have at least ${args.requiredLength} characters`;

	private readonly maxLength = (args: any): string =>
		`Must have less than ${args.requiredLength} characters`;

	private readonly required = (): string => `This field is required`;

	private readonly email = (): string => `Must be valid email address`;

	private readonly website = (): string => `Must be valid website address`;

	private readonly zipCode = (): string => `Must be valid zip code (######)`;

	private readonly fieldsMatch = (): string => `The passwords don't match`;
}
