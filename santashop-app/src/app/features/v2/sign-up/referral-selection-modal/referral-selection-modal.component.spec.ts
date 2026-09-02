import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
} from '../../../../../test-helpers';
import { ReferralSelectionModalComponent } from './referral-selection-modal.component';

describe('ReferralSelectionModalComponent', () => {
	let component: ReferralSelectionModalComponent;
	let fixture: ComponentFixture<ReferralSelectionModalComponent>;
	let modalController: Mocked<ModalController>;

	beforeEach(async () => {
		modalController = createModalControllerMock();
		await TestBed.configureTestingModule({
			imports: [ReferralSelectionModalComponent],
			providers: [
				{
					provide: ModalController,
					useValue: modalController,
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ReferralSelectionModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('returns a listed referral when saved', async () => {
		component.setChoice('Denver Human Services DHS');

		await component.save();

		expect(modalController.dismiss).toHaveBeenCalledWith(
			'Denver Human Services DHS',
			'confirm',
		);
	});

	it('trims and prefixes a valid Other answer', async () => {
		component.setChoice('Other');
		component.otherForm.controls.other.setValue('  Neighbor  ');

		await component.save();

		expect(modalController.dismiss).toHaveBeenCalledWith(
			'Other:Neighbor',
			'confirm',
		);
	});

	it('requires a three-to-twenty-character Other answer', async () => {
		component.setChoice('Other');
		component.otherForm.controls.other.setValue('ab');

		await component.save();

		expect(modalController.dismiss).not.toHaveBeenCalled();
	});

	it('returns to the list when reset is selected', () => {
		component.setChoice('Other');
		component.otherForm.controls.other.setValue('Neighbor');

		component.setChoice();

		expect(component.selectedReferral).toBeUndefined();
		expect(component.otherForm.controls.other.value).toBe('');
	});

	it('treats an empty current value as no selection', () => {
		component.currentValue = '';

		expect(component.selectedReferral).toBeUndefined();
	});

	it('renders the available choices as labelled native lists of buttons', async () => {
		await fixture.whenStable();

		const optionLists = fixture.nativeElement.querySelectorAll(
			'ul.referral-options',
		) as NodeListOf<HTMLUListElement>;
		const referralButton = fixture.nativeElement.ownerDocument.getElementById(
			'referral-Denver Human Services DHS',
		) as HTMLButtonElement;

		expect(optionLists.length).toBeGreaterThan(0);
		expect(referralButton.tagName).toBe('BUTTON');
		expect(referralButton.closest('li')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[role="listitem"]')).toBeNull();
	});

	it('filters the rendered choices while the user types', async () => {
		const searchbar = fixture.nativeElement.querySelector(
			'#referralSearchbar',
		) as HTMLElement;

		searchbar.dispatchEvent(
			new CustomEvent('ionInput', { detail: { value: 'Whiz' } }),
		);
		await fixture.whenStable();

		const document = fixture.nativeElement.ownerDocument as Document;
		expect(document.getElementById('referral-Whiz Kids')).toBeTruthy();
		expect(document.getElementById('referral-Denver Health')).toBeNull();
	});
});
