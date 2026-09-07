import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../.storybook/registration/customer-story.helpers';
import { HomePage } from './home.page';

const meta = {
	title: 'Registration/Account/Home and Sign In',
	component: HomePage,
	decorators: customerStoryDecorators({ mode: 'sign-in' }),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The public entry page supports account choice, sign-in, and password reset states.',
			},
		},
	},
} satisfies Meta<HomePage>;

export default meta;
type Story = StoryObj<HomePage>;

export const SignIn: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole('heading', { name: /sign in/i })).toBeVisible();
		const email = canvasElement.querySelector(
			'#signInEmail',
		) as HTMLIonInputElement;
		const password = canvasElement.querySelector(
			'#signInPassword',
		) as HTMLIonInputElement;
		email.value = 'jordan.garcia@example.com';
		email.dispatchEvent(
			new CustomEvent('ionInput', {
				bubbles: true,
				detail: { value: email.value },
			}),
		);
		password.value = 'northpole2026';
		password.dispatchEvent(
			new CustomEvent('ionInput', {
				bubbles: true,
				detail: { value: password.value },
			}),
		);
		const submit = canvasElement.querySelector(
			'#signInButton',
		) as HTMLIonButtonElement;
		await waitFor(() => expect(submit).toBeEnabled());
		await userEvent.click(submit);
		expect(email.value).toBe('jordan.garcia@example.com');
	},
};
