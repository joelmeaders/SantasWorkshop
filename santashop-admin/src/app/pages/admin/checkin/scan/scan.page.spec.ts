import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ScanPage } from './scan.page';
import {
	provideFirestoreWrapperMock,
	provideAlertControllerMock,
	createScannerServiceMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { ScannerService } from './scanner.service';

describe('ScanPage', () => {
	let component: ScanPage;
	let fixture: ComponentFixture<ScanPage>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			imports: [ScanPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideAlertControllerMock(),
				{
					provide: ScannerService,
					useFactory: createScannerServiceMock,
				},
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ScanPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
