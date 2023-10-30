import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

export interface AppLetContext<T> {
	appLet: T | null;
}

@Directive({
	// eslint-disable-next-line @angular-eslint/directive-selector
	selector: '[appLet]',
})
export class AppLetDirective<T> {
	@Input() public set appLet(value: T) {
		this.context.appLet = value;
	}

	private readonly context: AppLetContext<T> = { appLet: null };

	constructor(
		viewContainer: ViewContainerRef,
		templateRef: TemplateRef<AppLetContext<T>>,
	) {
		viewContainer.createEmbeddedView(templateRef, this.context);
	}
}
