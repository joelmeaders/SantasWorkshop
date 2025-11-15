import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { DateTimeModalComponent } from './date-time-modal.component';
import { testHelpers } from '../../../../test-helpers';

describe('DateTimeModalComponent', () => {
	let component: DateTimeModalComponent;
	let fixture: ComponentFixture<DateTimeModalComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [IonicModule.forRoot(), DateTimeModalComponent],
			providers: [...testHelpers],
		}).compileComponents();

		fixture = TestBed.createComponent(DateTimeModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
