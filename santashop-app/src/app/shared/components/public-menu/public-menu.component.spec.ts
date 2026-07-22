import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverController } from '@ionic/angular/standalone';
import {
	createPopoverControllerMock,
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
