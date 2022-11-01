import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Child } from '@models/*';

@Component({
	selector: 'app-children-card',
	templateUrl: './children-card.component.html',
	styleUrls: ['./children-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildrenCardComponent {
	@Input() public children?: Child[];

	@Input() public childCount = 0;
}
