import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DuplicatePage } from './duplicate.page';
import {
	provideFirestoreWrapperMock,
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter, Router } from '@angular/router';
import { AnalyticsWrapper } from '@santashop/core';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';

describe('DuplicatePage', () => {
	let component: DuplicatePage;
	let fixture: ComponentFixture<DuplicatePage>;
	const logEventWithParams = vi.fn();

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [DuplicatePage],
			providers: [
				provideFirestoreWrapperMock(),
				provideActivatedRouteMock(),
				{ provide: AnalyticsWrapper, useValue: { logEventWithParams } },
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(DuplicatePage);
		component = fixture.componentInstance;
		vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('renders blocked scan details, converts dates, and records the view', async () => {
		const context = TestBed.inject(CheckInContextService);
		context.setBlockedScan({
			disposition: 'duplicate-risk',
			registration: { uid: 'customer-1', emailAddress: 'family@example.test' } as never,
			attempt: {
				inputMethod: 'manual',
				scannedOn: { toDate: (): Date => new Date('2026-12-10T10:00:00Z') },
				priorEventOn: new Date('2026-12-10T09:45:00Z'),
			} as never,
		});

		await fixture.whenStable();

		expect(fixture.nativeElement.textContent).toContain('Suspicious duplicate scan');
		expect(logEventWithParams).toHaveBeenCalledWith('admin_blocked_scan_view', {
			disposition: 'duplicate-risk',
		});
	});

	it('clears the current blocked scan before returning to the scanner', async () => {
		const context = TestBed.inject(CheckInContextService);
		context.setBlockedScan({
			disposition: 'cancelled',
			registration: { uid: 'customer-1' } as never,
			attempt: { inputMethod: 'camera' } as never,
		});

		await component.startOver();

		expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
			'/admin/checkin/scan',
		]);
	});
});
