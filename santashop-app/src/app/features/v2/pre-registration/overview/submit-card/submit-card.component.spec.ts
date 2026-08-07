import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideTranslateServiceMock } from '../../../../../../test-helpers';
import { SubmitCardComponent } from './submit-card.component';

describe('SubmitCardComponent', () => {
	let component: SubmitCardComponent;
	let fixture: ComponentFixture<SubmitCardComponent>;

	beforeEach(async (): Promise<void> => {
		await TestBed.configureTestingModule({
			imports: [SubmitCardComponent],
			providers: [
				provideTranslateServiceMock(),
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: { paramMap: { get: (): null => null } },
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SubmitCardComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('emits a validated email update request', () => {
		const request = vi.fn().mockName('request');
		component.emailUpdateRequested.subscribe(request);
		component.changeEmailForm.setValue({
			emailAddress: 'updated@example.com',
			password: 'current-password',
		});

		component.updateEmail();

		expect(request).toHaveBeenCalledWith({
			emailAddress: 'updated@example.com',
			password: 'current-password',
		});
	});

	it('announces review state changes to the workspace', () => {
		const reviewRequested = vi.fn().mockName('reviewRequested');
		const changesRequested = vi.fn().mockName('changesRequested');
		component.reviewRequested.subscribe(reviewRequested);
		component.changesRequested.subscribe(changesRequested);
		fixture.componentRef.setInput('canSubmit', true);

		component.open();
		expect(component.expanded()).toBe(true);
		expect(reviewRequested).toHaveBeenCalledOnce();

		component.makeChanges();
		expect(component.expanded()).toBe(false);
		expect(changesRequested).toHaveBeenCalledOnce();
	});
});
