import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'admin-admin',
	templateUrl: './admin.page.html',
	styleUrls: ['./admin.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {}
