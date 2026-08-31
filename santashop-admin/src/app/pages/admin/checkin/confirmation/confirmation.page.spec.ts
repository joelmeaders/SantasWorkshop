import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationPage } from './confirmation.page';
import { provideActivatedRouteMock } from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';

describe('ConfirmationPage', () => {
	let component: ConfirmationPage;
	let fixture: ComponentFixture<ConfirmationPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ConfirmationPage],
			providers: [provideActivatedRouteMock(), provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(ConfirmationPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('exposes the shared check-in state and clears it when leaving confirmation', () => {
		const context = TestBed.inject(CheckInContextService);
		const reset = vi.spyOn(context, 'reset');

		component.ionViewWillLeave();

		expect(component.checkin$).toBe(context.checkin$);
		expect(reset).toHaveBeenCalledOnce();
	});
});
