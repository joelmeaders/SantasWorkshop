import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../../.storybook/registration/customer-story.helpers';
import { PublicMenuComponent } from './public-menu.component';

const meta = {
	title: 'Registration/Navigation/Public Menu',
	component: PublicMenuComponent,
	decorators: customerStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Account, language, help, sign-out, and organization links for a signed-in customer.',
			},
		},
	},
} satisfies Meta<PublicMenuComponent>;

export default meta;
type Story = StoryObj<PublicMenuComponent>;

export const SignedInActions: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/my account/i)).toBeVisible();
		expect(canvas.getByText(/sign out/i)).toBeVisible();
		const help = canvas.getByText(/^help$/i);
		await userEvent.click(help);
		expect(help).toBeVisible();
	},
};
