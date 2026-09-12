import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ByEmailPage } from './by-email.page';

const meta = {
	title: 'Admin/Search/By Email',
	component: ByEmailPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Customer search form with email-address validation.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const search = canvas.getByText('Search').closest('ion-button');
		await expect(canvas.getByText('Search: Email')).toBeVisible();
		await expect(search).toHaveAttribute('disabled');
		await userEvent.click(canvas.getByText('Reset'));
	},
} satisfies Meta<typeof ByEmailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {};
