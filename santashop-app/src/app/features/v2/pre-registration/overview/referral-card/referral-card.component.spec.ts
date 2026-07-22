import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	provideFunctionsMock,
	provideTranslateServiceMock,
} from '../../../../../../test-helpers';
import { ReferralCardComponent } from './referral-card.component';

describe('ReferralCardComponent', () => {
	let component: ReferralCardComponent;
	let fixture: ComponentFixture<ReferralCardComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ReferralCardComponent],
			providers: [provideFunctionsMock(), provideTranslateServiceMock()],
		}).compileComponents();

		fixture = TestBed.createComponent(ReferralCardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
