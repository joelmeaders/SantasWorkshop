import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {
	provideAnalyticsMock,
	provideAuthMock,
	provideFirestoreMock,
	provideFunctionsMock,
	provideStorageMock,
	provideTranslateServiceMock,
	provideActivatedRouteMock,
} from '../../../../../../test-helpers';
import { ChangeInfoPage } from './change-info.page';

describe('ChangeInfoPage', () => {
	let component: ChangeInfoPage;
	let fixture: ComponentFixture<ChangeInfoPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ChangeInfoPage],
			providers: [
				provideFirestoreMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				provideAnalyticsMock(),
				provideStorageMock(),
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChangeInfoPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
