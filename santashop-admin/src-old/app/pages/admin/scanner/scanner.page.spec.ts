import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { ScannerPage } from './scanner.page';

describe('Tab1Page', () => {
	let component: ScannerPage;
	let fixture: ComponentFixture<ScannerPage>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ScannerPage],
			imports: [IonicModule.forRoot(), ExploreContainerComponentModule],
		}).compileComponents();

		fixture = TestBed.createComponent(ScannerPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
