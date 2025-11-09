import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ByNamePage } from './by-name.page';
import { provideFirestoreWrapperMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ByNamePage', () => {
	let component: ByNamePage;
	let fixture: ComponentFixture<ByNamePage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ByNamePage],
			providers: [provideFirestoreWrapperMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(ByNamePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
