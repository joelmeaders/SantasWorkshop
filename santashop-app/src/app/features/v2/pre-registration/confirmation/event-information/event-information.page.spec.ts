import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { EventInformationPage } from './event-information.page';

describe('EventInformationPage', () => {
	let component: EventInformationPage;
	let fixture: ComponentFixture<EventInformationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [EventInformationPage],
		}).compileComponents();

		fixture = TestBed.createComponent(EventInformationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
