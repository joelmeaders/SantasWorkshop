import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

export interface AppLetContext<T> {
  appLet: T | null;
}

@Directive({
  selector: '[coreLet]',
})
export class AppLetDirective<T> {
  @Input() set appLet(value: T) {
    this.context.appLet = value;
  }

  private readonly context: AppLetContext<T> = { appLet: null };

  constructor(
    _viewContainer: ViewContainerRef,
    _templateRef: TemplateRef<AppLetContext<T>>
  ) {
    _viewContainer.createEmbeddedView(_templateRef, this.context);
  }
}
