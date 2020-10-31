import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';

interface LetContext <T> {
  appLet: T | null;
}

@Directive({
  selector: '[appLet]',
})
export class LetDirective <T> {
  @Input() set appLet(value: T) {
    this._context.appLet = value;
  }

  private readonly _context: LetContext <T> = { appLet: null };

  constructor(_viewContainer: ViewContainerRef, _templateRef: TemplateRef <LetContext<T>>) {
    _viewContainer.createEmbeddedView(_templateRef, this._context);
  }
}
