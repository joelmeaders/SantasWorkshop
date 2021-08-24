import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl } from '@ngneat/reactive-forms';

@Component({
  selector: 'app-control-errors',
  templateUrl: './control-errors.component.html',
  styleUrls: ['./control-errors.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControlErrorsComponent {
  // Not sure why I had to add 'any' here to this project
  // and not to the other I've done...
  @Input() public control?: FormControl | any;
}
