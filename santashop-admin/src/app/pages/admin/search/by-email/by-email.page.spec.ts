import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ByEmailPage } from './by-email.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ByEmailPage', () => {
	let component: ByEmailPage;
	let fixture: ComponentFixture<ByEmailPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ByEmailPage],
			providers: [provideFirestoreWrapperMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(ByEmailPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
