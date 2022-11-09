import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
	selector: 'app-submit-card',
	templateUrl: './submit-card.component.html',
	styleUrls: ['./submit-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmitCardComponent {
	@Input() public canSubmit = false;
}
