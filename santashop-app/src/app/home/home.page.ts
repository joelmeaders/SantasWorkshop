import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly environmentName = `${environment.name}_${environment.label}`;
	public readonly environmentVersion = environment.version;

	constructor() {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
