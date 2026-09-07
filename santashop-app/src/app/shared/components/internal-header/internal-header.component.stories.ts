import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../../.storybook/registration/customer-story.helpers';
import { InternalHeaderComponent } from './internal-header.component';

const openMenu = fn(async () => ({
	present: fn(async () => undefined),
}));

const meta = {
	title: 'Registration/Shell/Internal Header',
	component: InternalHeaderComponent,
	decorators: customerStoryDecorators({ popoverCreate: openMenu }),
	parameters: {
		docs: {
			description: {
				component:
					'The signed-in customer header shows identity and opens the account and help menu.',
			},
		},
	},
} satisfies Meta<InternalHeaderComponent>;

export default meta;
type Story = StoryObj<InternalHeaderComponent>;

export const SignedInCustomer: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText('Jordan Garcia')).toBeVisible();
		const menu = canvasElement.querySelector(
			'#menuButton',
		) as HTMLIonButtonElement;
		expect(menu).toBeEnabled();
		await userEvent.click(menu);
		expect(openMenu).toHaveBeenCalledOnce();
	},
};
