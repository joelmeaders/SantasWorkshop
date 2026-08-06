import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, PopoverController } from '@ionic/angular/standalone';
import {
	createPopoverControllerMock,
	createModalControllerMock,
	provideTranslateServiceMock,
	provideAnalyticsMock,
	provideAuthMock,
	provideFunctionsMock,
} from '../../../../test-helpers';
import { PublicMenuComponent } from './public-menu.component';

describe('PublicMenuComponent', () => {
	let component: PublicMenuComponent;
	let fixture: ComponentFixture<PublicMenuComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PublicMenuComponent],
			providers: [
				provideAuthMock(),
				provideFunctionsMock(),
				provideAnalyticsMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
				{
					provide: ModalController,
					useValue: createModalControllerMock(),
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(PublicMenuComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
