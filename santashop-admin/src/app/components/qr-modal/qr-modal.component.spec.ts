import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { QrModalComponent } from './qr-modal.component';

describe('QrModalComponent', () => {
	let component: QrModalComponent;
	let fixture: ComponentFixture<QrModalComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [QrModalComponent],
			imports: [IonicModule.forRoot()],
		}).compileComponents();

		fixture = TestBed.createComponent(QrModalComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
