import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PublicMenuComponent } from './public-menu.component';

describe('PublicMenuComponent', () => {
	let component: PublicMenuComponent;
	let fixture: ComponentFixture<PublicMenuComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [PublicMenuComponent],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(PublicMenuComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
