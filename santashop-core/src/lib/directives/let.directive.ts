import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';

export interface AppLetContext<T> {
	appLet: T | null;
}

@Directive({
	 
	selector: '[appLet]',
	standalone: true,
})
export class AppLetDirective<T> {
	@Input() public set appLet(value: T) {
		this.context.appLet = value;
	}

	private readonly context: AppLetContext<T> = { appLet: null };

	constructor() {
		const viewContainer = inject(ViewContainerRef);
		const templateRef = inject<TemplateRef<AppLetContext<T>>>(TemplateRef);

		viewContainer.createEmbeddedView(templateRef, this.context);
	}
}
