import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ReferralModalComponent } from './referral-modal.component';
import { provideModalControllerMock } from '../../../../test-helpers';

describe('ReferralModalComponent', () => {
	let component: ReferralModalComponent;
	let fixture: ComponentFixture<ReferralModalComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ReferralModalComponent],
			providers: [provideModalControllerMock()],
		}).compileComponents();

		fixture = TestBed.createComponent(ReferralModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('filters referrals case-insensitively and preserves the full list for blank input', async () => {
		component.filter({ detail: { value: 'denver' } });
		await fixture.whenStable();
		await expect(firstValueFrom(component.referrals$)).resolves.toEqual(
			expect.arrayContaining(['Denver Human Services DHS', 'Denver Health']),
		);

		component.filter({ detail: { value: '' } });
		await fixture.whenStable();
		await expect(firstValueFrom(component.referrals$)).resolves.toHaveLength(
			component.allReferrals.length,
		);
	});

	it('dismisses a standard choice immediately', async () => {
		const modal = TestBed.inject(ModalController) as Mocked<ModalController>;

		await component.setValue('SNAP');
		await fixture.whenStable();

		expect(modal.dismiss).toHaveBeenCalledWith('SNAP');
	});

	it('keeps Other selected until it is explicitly saved', async () => {
		const modal = TestBed.inject(ModalController) as Mocked<ModalController>;

		await component.setValue('Other');
		await fixture.whenStable();
		expect(modal.dismiss).not.toHaveBeenCalled();

		await component.dismiss();
		expect(modal.dismiss).toHaveBeenCalledWith('Other:');
	});
});
