import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

	beforeEach(async () => {
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
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
