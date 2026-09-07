import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../.storybook/registration/customer-story.helpers';
import { SignUpPage } from './sign-up.page';

const meta = {
	title: 'Registration/Account/Create Account',
	component: SignUpPage,
	decorators: customerStoryDecorators({
		createAccountEnabled: true,
		currentUser: null,
	}),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The complete customer account form, including referral, newsletter, and legal consent controls.',
			},
		},
	},
} satisfies Meta<SignUpPage>;

export default meta;
type Story = StoryObj<SignUpPage>;

export const RegistrationOpen: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/set up your account/i)).toBeVisible();
		expect(
			canvas.getByRole('button', { name: /how did you hear/i }),
		).toHaveAttribute('aria-haspopup', 'dialog');
		const legal = canvasElement.querySelector(
			'#legalCheckbox',
		) as HTMLIonCheckboxElement;
		await userEvent.click(legal);
		await waitFor(() => expect(legal).toBeChecked());
		expect(canvasElement.querySelector('#submitButton')).toBeDisabled();
	},
};
