import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { ChildValidationService, MAX_BIRTHDATE, MIN_BIRTHDATE, MOBILE_EVENT } from '@core/*';
import { AddChildPageService } from './add-child.page.service';

@Component({
  selector: 'app-add-child',
  templateUrl: './add-child.page.html',
  styleUrls: ['./add-child.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ ChildValidationService, AddChildPageService ]
})
export class AddChildPage {

  public readonly form = this.viewService.form;
  public readonly minBirthDate = MIN_BIRTHDATE().toISOString();
  public readonly maxBirthDate = MAX_BIRTHDATE().toISOString();
  public readonly isInfant$ = this.viewService.isInfant$;


  constructor(
    private readonly viewService: AddChildPageService,
    @Inject(MOBILE_EVENT) public readonly mobileEvent: boolean,
  ) { }

  public async birthdaySelected() {
    await this.viewService.birthdaySelected();
  }

  public setInfant(isInfant: boolean) {
    this.viewService.setInfant(isInfant);
  }

  public async addChild() {
    await this.viewService.addChild();;
  }
}
