import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ChangePasswordPage } from './change-password.page';

describe('ChangePasswordPage', () => {
	let component: ChangePasswordPage;
	let fixture: ComponentFixture<ChangePasswordPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ChangePasswordPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(ChangePasswordPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
