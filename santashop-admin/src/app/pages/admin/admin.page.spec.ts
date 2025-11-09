import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AdminPage } from './admin.page';
import {
	provideFirestoreWrapperMock,
	provideAuthMock,
} from '../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('AdminPage', () => {
	let component: AdminPage;
	let fixture: ComponentFixture<AdminPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [AdminPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideAuthMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(AdminPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
