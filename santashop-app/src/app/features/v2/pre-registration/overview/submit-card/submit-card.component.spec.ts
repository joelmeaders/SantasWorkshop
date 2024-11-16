import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmitCardComponent } from './submit-card.component';

describe('SubmitCardComponent', () => {
	let component: SubmitCardComponent;
	let fixture: ComponentFixture<SubmitCardComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SubmitCardComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(SubmitCardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
