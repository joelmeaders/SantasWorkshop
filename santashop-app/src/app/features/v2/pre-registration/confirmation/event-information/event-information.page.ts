import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'app-event-information',
	templateUrl: './event-information.page.html',
	styleUrls: ['./event-information.page.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventInformationPage {}
