import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
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
			expect.arrayContaining([
				'Denver Human Services DHS',
				'Denver Health',
			]),
		);

		component.filter({ detail: { value: '' } });
		await fixture.whenStable();
		await expect(
			firstValueFrom(component.referrals$),
		).resolves.toHaveLength(component.allReferrals.length);
	});

	it('filters referrals from the searchbar input event', async () => {
		const searchbar = fixture.nativeElement.querySelector(
			'ion-searchbar',
		) as HTMLElement;

		searchbar.dispatchEvent(
			new CustomEvent('ionInput', { detail: { value: 'Whiz' } }),
		);
		await fixture.whenStable();

		await expect(firstValueFrom(component.referrals$)).resolves.toEqual([
			'Whiz Kids',
		]);
	});

	it('dismisses a standard choice immediately', async () => {
		const modal = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;

		await component.setValue('SNAP');
		await fixture.whenStable();

		expect(modal.dismiss).toHaveBeenCalledWith('SNAP');
	});

	it('keeps Other selected until it is explicitly saved', async () => {
		const modal = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;

		await component.setValue('Other');
		await fixture.whenStable();
		expect(modal.dismiss).not.toHaveBeenCalled();

		component.otherName.set('  Hosted QA  ');
		await component.saveOther();
		expect(modal.dismiss).toHaveBeenCalledWith('Other:Hosted QA');
	});
	it('cancels Other without saving the entered referral', async () => {
		const modal = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;
		await component.setValue('Other');
		component.otherName.set('Hosted QA');
		await component.dismiss();
		expect(modal.dismiss).toHaveBeenCalledWith();
	});

	it('does not save empty, short, or overlong custom referrals', async () => {
		const modal = TestBed.inject(
			ModalController,
		) as Mocked<ModalController>;
		await component.setValue('Other');
		for (const name of ['', '  ', 'ab', 'a'.repeat(21)]) {
			component.otherName.set(name);
			await component.saveOther();
		}
		expect(modal.dismiss).not.toHaveBeenCalled();
	});
});
