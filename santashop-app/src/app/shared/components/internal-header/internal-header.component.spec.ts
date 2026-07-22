import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { PopoverController } from '@ionic/angular/standalone';
import {
	createPopoverControllerMock,
	provideAuthMock,
	provideFunctionsMock,
} from '../../../../test-helpers';
import { InternalHeaderComponent } from './internal-header.component';

describe('InternalHeaderComponent', () => {
	let component: InternalHeaderComponent;
	let fixture: ComponentFixture<InternalHeaderComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [InternalHeaderComponent],
			providers: [
				provideAuthMock(),
				provideFunctionsMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(InternalHeaderComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
