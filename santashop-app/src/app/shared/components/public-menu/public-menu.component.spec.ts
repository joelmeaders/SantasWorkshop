import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Analytics } from '@angular/fire/analytics';
import { Auth } from '@angular/fire/auth';
import { Functions } from '@angular/fire/functions';
import { PopoverController } from '@ionic/angular/standalone';
import {
	createPopoverControllerMock,
	provideTranslateServiceMock,
	createAuthMock,
	createFunctionsMock,
	createAnalyticsMock,
} from '../../../../test-helpers';
import { PublicMenuComponent } from './public-menu.component';

describe('PublicMenuComponent', () => {
	let component: PublicMenuComponent;
	let fixture: ComponentFixture<PublicMenuComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PublicMenuComponent],
			providers: [
				{
					provide: Auth,
					useFactory: createAuthMock,
				},
				{
					provide: Functions,
					useFactory: createFunctionsMock,
				},
				{
					provide: Analytics,
					useFactory: createAnalyticsMock,
				},
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
