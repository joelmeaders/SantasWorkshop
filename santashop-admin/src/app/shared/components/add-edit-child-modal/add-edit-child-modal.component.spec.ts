import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AddEditChildModalComponent } from './add-edit-child-modal.component';
import { provideModalControllerMock } from '../../../../test-helpers';

describe('AddEditChildModalComponent', () => {
	let component: AddEditChildModalComponent;
	let fixture: ComponentFixture<AddEditChildModalComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [AddEditChildModalComponent],
			providers: [provideModalControllerMock()],
		}).compileComponents();

		fixture = TestBed.createComponent(AddEditChildModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
