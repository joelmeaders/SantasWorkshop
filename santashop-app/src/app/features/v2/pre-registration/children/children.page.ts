import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChildValidationService, IChild } from '@core/*';
import { Observable } from 'rxjs';
import { ChildrenPageService } from './children.page.service';

@Component({
  selector: 'app-children',
  templateUrl: './children.page.html',
  styleUrls: ['./children.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ ChildrenPageService, ChildValidationService ]
})
export class ChildrenPage {

  public readonly children$: Observable<IChild[] | undefined> =
    this.viewService.children$;

  constructor(
    public readonly viewService: ChildrenPageService
  ) { }

  public addChild(child: IChild): Promise<void> {
    return this.viewService.addChild(child);
  }

  public removeChild(child: IChild): Promise<void> {
    return this.viewService.removeChild(child);
  }
}
