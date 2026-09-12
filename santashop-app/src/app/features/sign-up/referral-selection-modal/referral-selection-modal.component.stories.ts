import {
	moduleMetadata,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { IonModal } from '@ionic/angular/standalone';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../../.storybook/registration/customer-story.helpers';
import { ReferralSelectionModalComponent } from './referral-selection-modal.component';

const meta = {
	title: 'Registration/Account/Referral Selection',
	component: ReferralSelectionModalComponent,
	decorators: customerStoryDecorators(),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'A searchable referral list with a validated free-text Other option.',
			},
		},
	},
} satisfies Meta<ReferralSelectionModalComponent>;

export default meta;
type Story = StoryObj<ReferralSelectionModalComponent>;

export const ScrollToLastOption: Story = {
	decorators: [moduleMetadata({ imports: [IonModal] })],
	render: () => ({
		template:
			'<button type="button" id="open-sheet">Open sheet</button><ion-modal trigger="open-sheet" [animated]="false" aria-label="How did you hear about us?"><ng-template><app-referral-selection-modal class="ion-page" /></ng-template></ion-modal>',
	}),
	play: async ({ canvasElement }) => {
		const modal = canvasElement.querySelector(
			'ion-modal',
		) as HTMLIonModalElement;
		await userEvent.click(
			within(canvasElement).getByRole('button', { name: 'Open sheet' }),
		);
		await waitFor(() => expect(modal).toBeVisible(), { timeout: 10000 });
		await waitFor(() =>
			expect(
				modal.querySelectorAll('.referral-option').length,
			).toBeGreaterThan(10),
		);
		const content = modal.querySelector(
			'ion-content',
		) as HTMLIonContentElement;
		await waitFor(() =>
			expect(content.getBoundingClientRect().height).toBeGreaterThan(200),
		);
		await content.scrollToBottom(0);
		const options =
			modal.querySelectorAll<HTMLButtonElement>('.referral-option');
		const last = options[options.length - 1];
		await waitFor(() => {
			const scrollBounds = content.getBoundingClientRect();
			const lastBounds = last.getBoundingClientRect();
			expect(lastBounds.bottom).toBeLessThanOrEqual(scrollBounds.bottom);
			expect(lastBounds.top).toBeGreaterThanOrEqual(scrollBounds.top);
			expect(scrollBounds.bottom).toBeLessThanOrEqual(window.innerHeight);
		});
		await userEvent.click(last);
		expect(within(modal).getByText(/you selected/i)).toBeVisible();
		await userEvent.click(
			modal.querySelector('#resetReferralButton') as HTMLElement,
		);
		await content.scrollToBottom(0);
	},
};

export const SearchAndSelect: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole('searchbox')).toBeVisible();
		const other = canvas.getByRole('button', { name: /^other/i });
		await userEvent.click(other);
		expect(canvas.getByText(/you selected/i)).toBeVisible();
		expect(
			canvasElement.querySelector('#saveReferralButton'),
		).toBeDisabled();
	},
};

export const ExistingOtherReferral: Story = {
	args: { currentValue: 'Other:Neighborhood flyer' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/you selected/i)).toBeVisible();
		expect(
			canvasElement.querySelector('#saveReferralButton'),
		).toBeEnabled();
		await userEvent.click(
			canvasElement.querySelector('#resetReferralButton') as HTMLElement,
		);
		expect(canvas.getByRole('searchbox')).toBeVisible();
	},
};
