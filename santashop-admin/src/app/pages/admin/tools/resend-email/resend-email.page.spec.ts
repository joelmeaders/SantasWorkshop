import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResendEmailPage } from './resend-email.page';
import {
	provideActivatedRouteMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { FunctionsWrapper } from '@santashop/core';
import { LookupService } from '../../../../shared/services/lookup.service';
import { of, throwError } from 'rxjs';

describe('ResendEmailPage', () => {
	let component: ResendEmailPage;
	let fixture: ComponentFixture<ResendEmailPage>;
	const getSearchIndexByEmailAddress$ = vi.fn();
	const callable = vi.fn();
	const callableWrapper = vi.fn().mockReturnValue(callable);
	const loading = { present: vi.fn().mockResolvedValue(undefined) };
	const createLoading = vi.fn().mockResolvedValue(loading);
	const getTop = vi.fn().mockResolvedValue({});
	const dismiss = vi.fn().mockResolvedValue(true);
	const presentedAlerts: { present: ReturnType<typeof vi.fn>; onDidDismiss: ReturnType<typeof vi.fn> }[] = [];
	const createAlert = vi.fn(async () => {
		const alert = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue(undefined) };
		presentedAlerts.push(alert);
		return alert;
	});

	beforeEach(async () => {
		getSearchIndexByEmailAddress$.mockReset();
		getSearchIndexByEmailAddress$.mockReturnValue(of(undefined));
		callable.mockReset(); callable.mockResolvedValue({ data: 1 }); callableWrapper.mockClear();
		loading.present.mockClear(); createLoading.mockClear(); getTop.mockClear(); dismiss.mockClear();
		presentedAlerts.length = 0; createAlert.mockClear();
		TestBed.configureTestingModule({
			imports: [ResendEmailPage],
			providers: [
				{ provide: LookupService, useValue: { getSearchIndexByEmailAddress$ } },
				{ provide: FunctionsWrapper, useValue: { callableWrapper } },
				{ provide: AlertController, useValue: { create: createAlert } },
				{ provide: LoadingController, useValue: { create: createLoading, getTop, dismiss } },
				provideActivatedRouteMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ResendEmailPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('shows a not-found alert and does not send an email without a search index', async () => {
		component.form.controls['emailAddress'].setValue('MISSING@EXAMPLE.TEST');

		await component.searchAndSend();

		expect(getSearchIndexByEmailAddress$).toHaveBeenCalledWith('missing@example.test');
		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({ header: 'Not Found' }));
		expect(callable).not.toHaveBeenCalled();
		expect(dismiss).toHaveBeenCalledOnce();
	});

	it('looks up, sends, clears the form, and confirms a registration email', async () => {
		component.form.controls['emailAddress'].setValue('FAMILY@EXAMPLE.TEST');
		getSearchIndexByEmailAddress$.mockReturnValue(of({ customerId: 'customer-1' }));

		await component.searchAndSend();

		expect(callableWrapper).toHaveBeenCalledWith('callableResendRegistrationEmail');
		expect(callable).toHaveBeenCalledWith({ customerId: 'customer-1' });
		expect(createAlert).toHaveBeenLastCalledWith(expect.objectContaining({ header: 'Email sent!' }));
		expect(component.form.controls['emailAddress'].value).toBeNull();
		expect(dismiss).toHaveBeenCalledTimes(2);
	});

	it('reports lookup and delivery errors while always dismissing active loaders', async () => {
		component.form.controls['emailAddress'].setValue('family@example.test');
		getSearchIndexByEmailAddress$.mockReturnValue(throwError(() => ({ details: 'Lookup unavailable' })));

		await component.searchAndSend();
		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Error - could not find customer',
		}));

		getSearchIndexByEmailAddress$.mockReturnValue(of({ customerId: 'customer-1' }));
		callable.mockRejectedValue({ message: 'Delivery unavailable' });
		await component.searchAndSend();

		expect(createAlert).toHaveBeenCalledWith(expect.objectContaining({
			header: 'Error - could not send email',
		}));
		expect(dismiss).toHaveBeenCalledTimes(3);
	});

	it('resets the entry form on demand', () => {
		component.form.controls['emailAddress'].setValue('family@example.test');
		component.reset();
		expect(component.form.controls['emailAddress'].value).toBeNull();
	});
});
