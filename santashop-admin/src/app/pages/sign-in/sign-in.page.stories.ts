import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../.storybook/admin/admin-story.providers';
import { SignInPage } from './sign-in.page';

const meta = {
	title: 'Admin/Authentication/Sign In',
	component: SignInPage,
	decorators: adminStoryDecorators(),
	// Release metadata is fixture data here. The page unit test checks real config.
	render: (): {
		props: { environmentName: string; environmentVersion: string };
	} => ({
		props: {
			environmentName: '@santashop/admin_LOCAL',
			environmentVersion: '2026.09.0-beta.2',
		},
	}),
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
		await expect(canvas.getByText(/2026\.09\.0-beta\.2/)).toBeVisible();
		await expect(login).toHaveAttribute('disabled');
		await userEvent.click(canvas.getByText('Sign in'));
	},
} satisfies Meta<typeof SignInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {};
