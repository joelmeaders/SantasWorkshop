import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ByEmailPage } from './by-email.page';

describe('ByEmailPage', () => {
	let component: ByEmailPage;
	let fixture: ComponentFixture<ByEmailPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ByEmailPage],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(ByEmailPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
