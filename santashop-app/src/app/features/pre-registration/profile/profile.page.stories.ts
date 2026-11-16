import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	type CustomerStoryControls,
	createCustomerStoryControls,
	customerStoryDecorators,
	storyProfile,
} from '../../../../../../.storybook/registration/customer-story.helpers';
import { ProfilePage } from './profile.page';

let renderedUpdateControls: CustomerStoryControls | undefined;
const createAccountControls = (): CustomerStoryControls => {
	return createCustomerStoryControls();
};
const createUpdateControls = (): CustomerStoryControls => {
	const controls = createCustomerStoryControls();
	renderedUpdateControls = controls;
	return controls;
};

const meta = {
	title: 'Registration/Account/Profile',
	component: ProfilePage,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Signed-in settings for the customer profile, email address, and password.',
			},
		},
	},
} satisfies Meta<ProfilePage>;

export default meta;
type Story = StoryObj<ProfilePage>;

export const AccountSettings: Story = {
	decorators: customerStoryDecorators({ controls: createAccountControls }),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(
			canvas.getByRole('heading', { name: /my account/i }),
		).toBeVisible();
		expect(canvas.getByText(/jordan garcia/i)).toBeVisible();
		const emailSummary = canvas.getByText(/change email/i);
		await userEvent.click(emailSummary);
		expect(canvasElement.querySelectorAll('details[open]')).toHaveLength(2);
		expect(canvas.getByDisplayValue('80205')).toBeVisible();
		const passwordPanel = canvasElement.querySelectorAll('details')[2];
		await userEvent.click(
			within(passwordPanel).getByText(/change password/i),
		);
		const newPassword = passwordPanel.querySelector(
			'ion-input[formControlName="newPassword"]',
		) as HTMLIonInputElement;
		const native = await newPassword.getInputElement();
		await userEvent.type(native, 'winter-pass-2026');
		await userEvent.click(
			newPassword.querySelector('button.password-toggle') as HTMLElement,
		);
		await waitFor(() => expect(native).toHaveAttribute('type', 'text'));
		expect(native).toHaveValue('winter-pass-2026');
		await userEvent.click(
			newPassword.querySelector('button.password-toggle') as HTMLElement,
		);
		await waitFor(() => expect(native).toHaveAttribute('type', 'password'));
		expect(passwordPanel.querySelectorAll('ion-input')).toHaveLength(2);
		await userEvent.clear(native);
		await userEvent.click(
			within(passwordPanel).getByText(/change password/i),
		);
	},
};

export const ProfileDataUpdates: Story = {
	decorators: customerStoryDecorators({ controls: createUpdateControls }),
	play: async ({ canvasElement }) => {
		if (!renderedUpdateControls)
			throw new Error('Profile controls were not created');
		const canvas = within(canvasElement);
		const updatedProfile = {
			...storyProfile,
			firstName: 'Alex',
			lastName: 'Garcia',
			emailAddress: 'alex.garcia@example.com',
			zipCode: '80206',
		};

		renderedUpdateControls.userProfile$.next(updatedProfile);
		await waitFor(() =>
			expect(canvas.getByText(/alex garcia · 80206/i)).toBeVisible(),
		);
		expect(canvas.getByText('alex.garcia@example.com')).toBeVisible();

		renderedUpdateControls.userProfile$.next(storyProfile);
		await waitFor(() =>
			expect(canvas.getByText(/jordan garcia · 80205/i)).toBeVisible(),
		);
	},
};
