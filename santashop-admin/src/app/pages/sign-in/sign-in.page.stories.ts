import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../.storybook/admin/admin-story.providers';
import { SignInPage } from './sign-in.page';

const meta = {
	title: 'Admin/Authentication/Sign In',
	component: SignInPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Staff sign-in with email validation, password validation, and a guarded submit action. Authentication stays local in this story.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const login = canvas.getByText('Login').closest('ion-button');
		await expect(canvas.getByText('Sign in')).toBeVisible();
		await expect(login).toHaveAttribute('disabled');
		await userEvent.click(canvas.getByText('Sign in'));
	},
} satisfies Meta<typeof SignInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {};
