import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { QuickRegisterPage } from './quick-register.page';

describe('quickregisterPage', () => {
	let component: QuickRegisterPage;
	let fixture: ComponentFixture<QuickRegisterPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [QuickRegisterPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(QuickRegisterPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
