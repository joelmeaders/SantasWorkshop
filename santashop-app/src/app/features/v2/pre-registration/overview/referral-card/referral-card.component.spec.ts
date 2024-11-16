import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferralCardComponent } from './referral-card.component';

describe('ReferralCardComponent', () => {
	let component: ReferralCardComponent;
	let fixture: ComponentFixture<ReferralCardComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ReferralCardComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(ReferralCardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
