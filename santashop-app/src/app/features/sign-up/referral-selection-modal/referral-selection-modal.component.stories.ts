import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
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
