import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ManageChildrenComponent } from './manage-children.component';
import {
	provideModalControllerMock,
	provideAlertControllerMock,
} from '../../../../test-helpers';

describe('ManageChildrenComponent', () => {
	let component: ManageChildrenComponent;
	let fixture: ComponentFixture<ManageChildrenComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ManageChildrenComponent],
			providers: [
				provideModalControllerMock(),
				provideAlertControllerMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ManageChildrenComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
