import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';

@Component({
	selector: 'app-testpage',
	templateUrl: './testpage.page.html',
	styleUrls: ['./testpage.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestpagePage {
	public readonly testVar$ = of(true);
}
