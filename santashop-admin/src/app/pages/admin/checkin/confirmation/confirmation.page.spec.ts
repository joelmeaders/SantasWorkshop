import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ConfirmationPage } from './confirmation.page';
import { provideActivatedRouteMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ConfirmationPage', () => {
	let component: ConfirmationPage;
	let fixture: ComponentFixture<ConfirmationPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ConfirmationPage],
			providers: [provideActivatedRouteMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(ConfirmationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
