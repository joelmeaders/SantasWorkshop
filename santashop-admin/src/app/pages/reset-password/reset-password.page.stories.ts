import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../.storybook/admin/admin-story.providers';
import { ResetPasswordPage } from './reset-password.page';
const meta = {
	title: 'Admin/Authentication/Password Reset',
	component: ResetPasswordPage,
	decorators: adminStoryDecorators(),
	play: async ({ canvasElement }): Promise<void> => {
		const c = within(canvasElement);
		await expect(c.getByText('Reset your password')).toBeVisible();
		await expect(c.getByText('Back to sign in')).toBeVisible();
	},
} satisfies Meta<ResetPasswordPage>;
export default meta;
type Story = StoryObj<ResetPasswordPage>;
export const EmptyForm: Story = {};
export const AcceptedRequest: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		const c = within(canvasElement);
		const input = canvasElement.querySelector(
			'#adminResetEmail',
		) as HTMLIonInputElement;
		await userEvent.type(
			await input.getInputElement(),
			'staff@example.test',
		);
		await userEvent.click(c.getByText('Send reset instructions'));
		await expect(await c.findByText(/If an account exists/)).toBeVisible();
	},
};
export const SpanishDark: Story = {
	parameters: { adminLanguage: 'es', adminTheme: 'dark' },
	play: async ({ canvasElement }): Promise<void> => {
		const c = within(canvasElement);
		await expect(c.getByText('Restablezca su contraseña')).toBeVisible();
	},
};
