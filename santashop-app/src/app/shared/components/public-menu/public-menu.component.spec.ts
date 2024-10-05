import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicMenuComponent } from './public-menu.component';

describe('PublicMenuComponent', () => {
	let component: PublicMenuComponent;
	let fixture: ComponentFixture<PublicMenuComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			imports: [PublicMenuComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(PublicMenuComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
