import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
	createAppStateServiceMock,
	provideActivatedRouteMock,
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
} from '../../test-helpers';

import { HomePage } from './home.page';
import { LoadingController, ModalController } from '@ionic/angular/standalone';
import { AppStateService, ErrorHandlerService } from '@santashop/core';

describe('HomePage', () => {
	let component: HomePage;
	let fixture: ComponentFixture<HomePage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HomePage],
			providers: [
				{
					provide: AppStateService,
					useFactory: createAppStateServiceMock,
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideAnalyticsMock(),
				provideAuthMock(),
				provideFunctionsMock(),
				{
					provide: ErrorHandlerService,
					useValue: jasmine.createSpyObj('ErrorHandlerService', ['handleError']),
				},
				{
					provide: LoadingController,
					useValue: jasmine.createSpyObj('LoadingController', ['create']),
				},
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(HomePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
