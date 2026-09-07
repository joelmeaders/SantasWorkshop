import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ResendEmailPage } from './resend-email.page';

const meta = {
	title: 'Admin/Tools/Resend Registration Email',
	component: ResendEmailPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Lookup and resend workflow for a completed registration. The story uses local lookup and callable fakes.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/Enter the customer's email address/)).toBeVisible();
		await expect(canvas.getByText('Send Email').closest('ion-button')).toHaveAttribute(
			'disabled',
		);
	},
} satisfies Meta<ResendEmailPage>;

export default meta;
type Story = StoryObj<ResendEmailPage>;

export const AwaitingEmailAddress: Story = {};
