import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	provideAnalyticsMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	provideActivatedRouteMock,
	provideTranslateServiceMock,
} from '../../../../../test-helpers';
import { SubmitPage } from './submit.page';

describe('SubmitPage', () => {
	let component: SubmitPage;
	let fixture: ComponentFixture<SubmitPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [SubmitPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideStorageMock(),
				provideAnalyticsMock(),
				provideActivatedRouteMock(),
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(SubmitPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
