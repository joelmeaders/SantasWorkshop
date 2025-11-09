import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { provideActivatedRouteMock } from '../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('HeaderComponent', () => {
	let component: HeaderComponent;
	let fixture: ComponentFixture<HeaderComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [HeaderComponent],
			providers: [provideActivatedRouteMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(HeaderComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
